import assert from 'node:assert/strict';
import test from 'node:test';

import { shouldAttemptRefresh } from './refresh-policy.ts';

test('does not replace authentication endpoint errors with refresh failures', () => {
  assert.equal(shouldAttemptRefresh(401, '/auth/login', false), false);
  assert.equal(shouldAttemptRefresh(401, '/auth/register', false), false);
});

test('refreshes an expired session once for protected API calls', () => {
  assert.equal(shouldAttemptRefresh(401, '/posts/feed', false), true);
  assert.equal(shouldAttemptRefresh(401, '/posts/feed', true), false);
});
