import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { v2 as cloudinary } from 'cloudinary';
import { MediaService } from './media.service.js';
import crypto from 'node:crypto';
import { HttpException } from '@nestjs/common';

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

test('verifyMediaItems validates user ownership and Cloudinary signatures', () => {
  const originalSecret = process.env.CLOUDINARY_API_SECRET;
  const originalCloud = process.env.CLOUDINARY_CLOUD_NAME;
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';

  try {
    const service = new MediaService();
    const userId = 'user-123';
    const publicId = `mxh/${userId}/posts/asset-1`;
    const version = 123456789;
    const signaturePayload = `public_id=${publicId}&version=${version}test-secret`;
    const validSignature = crypto.createHash('sha1').update(signaturePayload).digest('hex');

    const result = service.verifyMediaItems(userId, [
      {
        publicId,
        version,
        signature: validSignature,
        type: 'IMAGE',
        width: 800,
        height: 600,
        order: 0,
      },
    ]);

    assert.equal(result.length, 1);
    assert.equal(result[0].publicId, publicId);
    assert.equal(
      result[0].url,
      `https://res.cloudinary.com/test-cloud/image/upload/v${version}/${publicId}`,
    );

    // Rejects other user's asset
    assert.throws(
      () =>
        service.verifyMediaItems(userId, [
          {
            publicId: 'mxh/other-user/posts/asset-2',
            version,
            signature: validSignature,
            type: 'IMAGE',
            order: 0,
          },
        ]),
      (error: unknown) => error instanceof HttpException,
    );

    // Rejects invalid signature
    assert.throws(
      () =>
        service.verifyMediaItems(userId, [
          {
            publicId,
            version,
            signature: 'invalid-signature',
            type: 'IMAGE',
            order: 0,
          },
        ]),
      (error: unknown) => error instanceof HttpException &&
        (error.getResponse() as { code?: string }).code === 'MEDIA_INVALID_SIGNATURE',
    );
  } finally {
    process.env.CLOUDINARY_API_SECRET = originalSecret;
    process.env.CLOUDINARY_CLOUD_NAME = originalCloud;
  }
});
