import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UsersService } from './users.service.js';
import { UsersRepository } from './users.repository.js';
import { UsersAuthService } from './users-auth.service.js';
import argon2 from 'argon2';

function createUsersService(prisma: any, media: any, events: any, repository?: any) {
  return new UsersService(repository ?? new UsersRepository(prisma), media, events);
}

test('auth facade returns account fields without password hash', async () => {
  const record = {
    id: 'user-id', email: 'user@example.test', username: 'user', displayName: 'User',
    avatarUrl: null, bannerUrl: null, bio: null, isEmailVerified: true,
    isActive: true, createdAt: new Date(), passwordHash: 'private-password-hash',
  };
  const repository = { async findByEmail() { return record; } };
  const usersAuth = new UsersAuthService(repository as any);

  const account = await usersAuth.findUserByEmail('user@example.test');
  assert.equal(account?.id, 'user-id');
  assert.equal('passwordHash' in (account ?? {}), false);
});

test('auth facade exposes only a session ID after creation', async () => {
  const repository = {
    async createSession() { return { id: 'session-id', tokenHash: 'private-token-hash', ipAddress: '127.0.0.1' }; },
  };
  const usersAuth = new UsersAuthService(repository as any);

  const result = await usersAuth.createSession({} as any);
  assert.deepEqual(result, { id: 'session-id' });
});

test('access session facade omits private token and user fields', async () => {
  const session = {
    userId: 'user-id',
    tokenHash: 'private-token-hash',
    isRevoked: false,
    expiresAt: new Date(Date.now() + 60_000),
    user: { isActive: true, isEmailVerified: true, passwordHash: 'private-password-hash' },
  };
  const sessionTable = { where() { return { include() { return this; }, async first() { return session; } }; } };
  const users = createUsersService({ client: { orm: { public: { Session: sessionTable } } } } as any, {} as any, {} as any);

  assert.deepEqual(await (users as any).getAccessSessionState('session-id'), {
    userId: 'user-id',
    isRevoked: false,
    expiresAt: session.expiresAt,
    isActive: true,
    isEmailVerified: true,
  });
});

test('public user lookup does not expose credential fields to PostsModule', async () => {
  const user = {
    id: 'user-id', username: 'user', displayName: 'User', avatarUrl: null,
    bio: null, isActive: true, isEmailVerified: true,
    email: 'private@example.test', passwordHash: 'private-password-hash',
  };
  const userTable = { where() { return { async first() { return user; } }; } };
  const users = createUsersService({ client: { orm: { public: { User: userTable } } } } as any, {} as any, {} as any);

  assert.deepEqual(await users.findActiveUserById('user-id'), {
    id: 'user-id', username: 'user', displayName: 'User', avatarUrl: null,
    bio: null, isActive: true, isEmailVerified: true,
  });
});

test('user search uses the Users repository boundary', async () => {
  const user = { id: 'a', username: 'alice', displayName: 'Alice', avatarUrl: null, bio: null };
  const repository = { async searchActiveUsers() { return { byUsername: [user], byDisplayName: [] }; } };
  const users = createUsersService({} as any, {} as any, {} as any, repository as any);

  assert.deepEqual((await users.searchUsers('ali')).items, [user]);
});

test('profile reads and counts use the Users repository boundary', async () => {
  const user = {
    id: 'a', email: 'a@example.test', username: 'alice', displayName: 'Alice',
    bio: null, avatarUrl: null, avatarPublicId: null, bannerUrl: null,
    bannerPublicId: null, isActive: true, isEmailVerified: true, createdAt: new Date(),
  };
  const repository = {
    async findById() { return user; },
    async countFollowers() { return 2; },
    async countFollowing() { return 3; },
  };
  const users = createUsersService({} as any, {} as any, {} as any, repository as any);

  const profile = await users.getMyProfile('a');
  assert.equal(profile.followersCount, 2);
  assert.equal(profile.followingCount, 3);
  assert.equal(profile.email, 'a@example.test');
});

test('suggestions read candidates and follows through the Users repository', async () => {
  const candidate = { id: 'candidate', username: 'candidate', displayName: 'Candidate', avatarUrl: null, bio: null };
  const repository = {
    async findSuggestionCandidates() { return [candidate]; },
    async findFollowsToCandidates() { return []; },
  };
  const users = createUsersService({} as any, {} as any, {} as any, repository as any);

  assert.deepEqual((await users.suggestUsers('viewer')).items, [candidate]);
});

test('following another user writes through the Users repository', async () => {
  const repository = {
    async findById(id: string) {
      return id === 'viewer'
        ? { id, isActive: true, isEmailVerified: true }
        : { id, displayName: 'Target', isActive: true, isEmailVerified: true };
    },
    async findFollow() { return null; },
    async createFollow() { return { id: 'follow-id' }; },
  };
  const events: string[] = [];
  const users = createUsersService({} as any, {} as any, { emit(name: string) { events.push(name); } } as any, repository as any);

  assert.deepEqual(await users.followUser('viewer', 'target'), { message: 'Đã theo dõi Target' });
  assert.equal(events.length, 1);
});

test('profile update writes through the Users repository before media cleanup', async () => {
  const user = {
    id: 'a', email: 'a@example.test', username: 'alice', displayName: 'Alice',
    bio: null, avatarUrl: null, avatarPublicId: null, bannerUrl: null,
    bannerPublicId: null, isActive: true, isEmailVerified: true, createdAt: new Date(),
  };
  const actions: string[] = [];
  const repository = {
    async findById() { return user; },
    async updateUser(_id: string, data: Record<string, unknown>) { actions.push('update'); Object.assign(user, data); },
    async countFollowers() { return 0; },
    async countFollowing() { return 0; },
  };
  const media = { async deleteFile() { actions.push('cleanup'); } };
  const users = createUsersService({} as any, media as any, {} as any, repository as any);

  const result = await users.updateProfile('a', { displayName: 'Updated' });
  assert.equal(result.displayName, 'Updated');
  assert.equal(actions[0], 'update');
});

test('password change transaction runs through the Users repository', async () => {
  const passwordHash = await argon2.hash('Old1234!');
  const repository = {
    async findById() { return { id: 'a', isActive: true, passwordHash }; },
    async changePasswordAndRevokeSessions() {},
  };
  const users = createUsersService({} as any, {} as any, { emit() {} } as any, repository as any);

  assert.deepEqual(await users.changePassword('a', {
    oldPassword: 'Old1234!', newPassword: 'New5678!', logoutOtherDevices: true,
  }, 'current'), { message: 'Đổi mật khẩu thành công' });
});

test('follower listing uses the Users repository for page data and count', async () => {
  const follower = { id: 'follower', username: 'bob', displayName: 'Bob', avatarUrl: null, bio: null };
  const repository = {
    async findByUsername() { return { id: 'alice', isActive: true, isEmailVerified: true }; },
    async listFollowers() { return [{ followerId: 'follower', createdAt: new Date(), follower }]; },
    async countFollowers() { return 1; },
  };
  const users = createUsersService({} as any, {} as any, {} as any, repository as any);

  const result = await users.getFollowers('alice', { page: 1, limit: 20 });
  assert.deepEqual(result.items, [follower]);
  assert.equal(result.meta.total, 1);
});

test('a failed profile database update keeps the currently referenced media', async () => {
  const currentUser = {
    id: 'user-id',
    email: 'user@example.com',
    username: 'user',
    displayName: 'User',
    bio: null,
    avatarUrl: 'https://example.com/old.jpg',
    avatarPublicId: 'mxh/user-id/avatars/old',
    bannerUrl: null,
    bannerPublicId: null,
    isActive: true,
    createdAt: new Date(),
  };
  const userTable = {
    where() {
      return {
        async first() { return currentUser; },
        async update() { throw new Error('database unavailable'); },
      };
    },
  };
  const deletedPublicIds: string[] = [];
  const mediaService = {
    async deleteFile(publicId: string) {
      deletedPublicIds.push(publicId);
    },
  };
  const service = createUsersService(
    { client: { orm: { public: { User: userTable } } } } as any,
    mediaService as any,
    {} as any,
  );

  await assert.rejects(
    service.updateProfile('user-id', {
      avatarUrl: 'https://example.com/new.jpg',
      avatarPublicId: 'mxh/user-id/avatars/new',
    }),
    /database unavailable/,
  );
  assert.deepEqual(deletedPublicIds, []);
});

test('password change rolls back when revoking other sessions fails', async () => {
  const originalHash = await argon2.hash('Old1234!');
  let passwordHash = originalHash;
  const userTable = { where() { return { async first() { return { id: 'user-id', isActive: true, passwordHash }; }, async update(data: { passwordHash: string }) { passwordHash = data.passwordHash; } }; } };
  const sessionTable = { where() { return { async all() { return [{ id: 'current' }, { id: 'other' }]; }, async update() { throw new Error('session update failed'); } }; } };
  const orm = { public: { User: userTable, Session: sessionTable } };
  const client = { orm, async transaction<T>(callback: (tx: { orm: typeof orm }) => Promise<T>) { const previous = passwordHash; try { return await callback({ orm }); } catch (error) { passwordHash = previous; throw error; } } };
  const service = createUsersService({ client } as any, {} as any, { emit() {} } as any);

  await assert.rejects(
    service.changePassword('user-id', { oldPassword: 'Old1234!', newPassword: 'New5678!', logoutOtherDevices: true }, 'current'),
    /session update failed/,
  );
  assert.equal(passwordHash, originalHash);
});

test('user search returns unique public profile fields and filters inactive accounts', async () => {
  const filters: string[] = [];
  const matchingUser = { id: 'a', email: 'private@example.test', username: 'alice', displayName: 'Alice', avatarUrl: null, bio: 'Hello' };
  const fields: any = {
    isActive: { eq(value: boolean) { filters.push(`active:${value}`); return true; } },
    isEmailVerified: { eq(value: boolean) { filters.push(`verified:${value}`); return true; } },
    username: { ilike(value: string) { filters.push(`username:${value}`); return true; }, asc: () => true },
    displayName: { ilike(value: string) { filters.push(`display:${value}`); return true; } },
  };
  const query: any = {
    where(callback: (value: any) => unknown) { callback(fields); return query; },
    orderBy() { return query; },
    limit() { return query; },
    async all() { return [matchingUser]; },
  };
  const service = createUsersService({ client: { orm: { public: { User: query } } } } as any, {} as any, {} as any);

  const response = await service.searchUsers('ali');

  assert.deepEqual(response.items, [{ id: 'a', username: 'alice', displayName: 'Alice', avatarUrl: null, bio: 'Hello' }]);
  assert.ok(filters.includes('active:true'));
  assert.ok(filters.includes('verified:true'));
  assert.ok(filters.includes('username:%ali%'));
  assert.ok(filters.includes('display:%ali%'));
});

test('user search paginates unique matches by username', async () => {
  const users = Array.from({ length: 25 }, (_, index) => ({
    id: `user-${index}`,
    username: `user${String(index).padStart(2, '0')}`,
    displayName: `User ${index}`,
    avatarUrl: null,
    bio: null,
  }));
  const userTable = {
    where() {
      let cursor = '';
      let limit = 0;
      const fields: any = {
        isActive: { eq: () => true },
        isEmailVerified: { eq: () => true },
        username: { ilike: () => true, gt(value: string) { cursor = value; return true; }, asc: () => true },
        displayName: { ilike: () => true },
      };
      const query: any = {
        where(callback: (value: any) => unknown) { callback(fields); return query; },
        orderBy() { return query; },
        limit(value: number) { limit = value; return query; },
        async all() { return users.filter((user) => user.username > cursor).slice(0, limit); },
      };
      return query;
    },
  };
  const service = createUsersService({ client: { orm: { public: { User: userTable } } } } as any, {} as any, {} as any);

  const first = await service.searchUsers('user', undefined, 20);
  const second = await service.searchUsers('user', first.nextCursor!, 20);

  assert.equal(first.items.length, 20);
  assert.equal(first.nextCursor, 'user19');
  assert.deepEqual(second.items.map((user) => user.username), ['user20', 'user21', 'user22', 'user23', 'user24']);
  assert.equal(second.nextCursor, null);
});
