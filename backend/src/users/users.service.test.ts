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
