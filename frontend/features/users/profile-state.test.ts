import assert from 'node:assert/strict';
import test from 'node:test';

import type { UserProfile } from '../../types/api.ts';
import { toggleProfileFollow } from './profile-state.ts';

const profile = { isFollowing: false, followersCount: 4 } as UserProfile;

test('toggleProfileFollow updates follow state and followers count immutably', () => {
  const next = toggleProfileFollow(profile);
  assert.equal(next.isFollowing, true);
  assert.equal(next.followersCount, 5);
  assert.equal(profile.followersCount, 4);
});

test('toggleProfileFollow prevents a negative follower count', () => {
  const next = toggleProfileFollow({ ...profile, isFollowing: true, followersCount: 0 });
  assert.equal(next.followersCount, 0);
});
