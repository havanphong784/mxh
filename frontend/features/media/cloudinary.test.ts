import assert from 'node:assert/strict';
import test from 'node:test';

import { toPostMediaInput, toUploadedMedia } from './cloudinary.ts';

test('toUploadedMedia uses the Cloudinary response signature verified by the backend', () => {
  const result = toUploadedMedia({ public_id: 'mxh/u/posts/a', version: 7, signature: 'response-signature', secure_url: 'https://cdn/a.jpg' }, false);
  assert.equal(result.signature, 'response-signature');
  assert.equal(result.publicId, 'mxh/u/posts/a');
  assert.equal(result.type, 'IMAGE');
});

test('toPostMediaInput sends only the fields accepted by PostMediaItemDto', () => {
  const uploaded = toUploadedMedia({ public_id: 'mxh/u/posts/a', version: 7, signature: 'response-signature', secure_url: 'https://cdn/a.jpg' }, false);

  assert.deepEqual(toPostMediaInput(uploaded, 2), {
    publicId: 'mxh/u/posts/a',
    version: '7',
    signature: 'response-signature',
    type: 'IMAGE',
    order: 2,
  });
});
