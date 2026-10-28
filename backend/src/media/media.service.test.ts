import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { v2 as cloudinary } from 'cloudinary';
import { MediaService } from './media.service.js';
import type { ConfigService } from '@nestjs/config';
import type { EnvironmentVariables } from '../config/env.validation.js';

function mockConfigService(overrides: Partial<EnvironmentVariables> = {}): ConfigService<EnvironmentVariables, true> {
  const env: Partial<EnvironmentVariables> = {
    CLOUDINARY_CLOUD_NAME: 'test-cloud',
    CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret',
    ...overrides,
  };
  return {
    get(key: string, _opts?: any) { return (env as any)[key]; },
    getOrThrow(key: string, _opts?: any) {
      const v = (env as any)[key];
      if (v === undefined) throw new Error(`Missing ${key}`);
      return v;
    },
  } as any;
}

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

  const service = new MediaService(mockConfigService());
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

  const service = new MediaService(mockConfigService());
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

  const service = new MediaService(mockConfigService());
  await service.deleteFile('mxh/user/posts/audio', 'AUDIO');

  assert.deepEqual(receivedOptions, { resource_type: 'video' });
});
