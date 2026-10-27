import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { UsersService } from './users.service.js';

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
  const service = new UsersService(
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
  const service = new UsersService({ client: { orm: { public: { User: query } } } } as any, {} as any, {} as any);

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
  const service = new UsersService({ client: { orm: { public: { User: userTable } } } } as any, {} as any, {} as any);

  const first = await service.searchUsers('user', undefined, 20);
  const second = await service.searchUsers('user', first.nextCursor!, 20);

  assert.equal(first.items.length, 20);
  assert.equal(first.nextCursor, 'user19');
  assert.deepEqual(second.items.map((user) => user.username), ['user20', 'user21', 'user22', 'user23', 'user24']);
  assert.equal(second.nextCursor, null);
});
