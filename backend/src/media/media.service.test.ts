import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { v2 as cloudinary } from 'cloudinary';
import { MediaService } from './media.service.js';

test('video-backed media is deleted with Cloudinary resource_type video', async (t) => {
  const originalDestroy = cloudinary.uploader.destroy;
  t.after(() => {
    cloudinary.uploader.destroy = originalDestroy;
  });

  let receivedOptions: Record<string, unknown> | undefined;
  cloudinary.uploader.destroy = (async (
    _publicId: string,
    options?: Record<string, unknown>,
  ) => {
    receivedOptions = options;
    return { result: 'ok' };
  }) as typeof cloudinary.uploader.destroy;

  const service = new MediaService();
  await (service.deleteFile as any)('mxh/user/posts/video', 'VIDEO');

  assert.deepEqual(receivedOptions, { resource_type: 'video' });
});

test('image media is deleted with Cloudinary resource_type image', async (t) => {
  const originalDestroy = cloudinary.uploader.destroy;
  t.after(() => {
    cloudinary.uploader.destroy = originalDestroy;
  });

  let receivedOptions: Record<string, unknown> | undefined;
  cloudinary.uploader.destroy = (async (
    _publicId: string,
    options?: Record<string, unknown>,
  ) => {
    receivedOptions = options;
    return { result: 'ok' };
  }) as typeof cloudinary.uploader.destroy;

  const service = new MediaService();
  await (service.deleteFile as any)('mxh/user/posts/image', 'IMAGE');

  assert.deepEqual(receivedOptions, { resource_type: 'image' });
});

test('audio media is deleted with Cloudinary resource_type video', async (t) => {
  const originalDestroy = cloudinary.uploader.destroy;
  t.after(() => {
    cloudinary.uploader.destroy = originalDestroy;
  });

  let receivedOptions: Record<string, unknown> | undefined;
  cloudinary.uploader.destroy = (async (
    _publicId: string,
    options?: Record<string, unknown>,
  ) => {
    receivedOptions = options;
    return { result: 'ok' };
  }) as typeof cloudinary.uploader.destroy;

  const service = new MediaService();
  await service.deleteFile('mxh/user/posts/audio', 'AUDIO');

  assert.deepEqual(receivedOptions, { resource_type: 'video' });
});
