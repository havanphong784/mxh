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
