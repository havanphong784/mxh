import assert from 'node:assert/strict';
import test from 'node:test';

import type { ActivePostItem } from '../../types/api.ts';
import { isActivePost, togglePostInteraction } from './post-state.ts';

const post = {
  id: 'p1',
  interactions: { isLiked: false, isReposted: false, isBookmarked: false },
  counters: { likeCount: 2, repostCount: 1, bookmarkCount: 0, replyCount: 0, quoteCount: 0 },
} as ActivePostItem;

test('togglePostInteraction changes like state and count without mutating the source', () => {
  const updated = togglePostInteraction(post, 'like');
  assert.equal(updated.interactions.isLiked, true);
  assert.equal(updated.counters.likeCount, 3);
  assert.equal(post.interactions.isLiked, false);
  assert.equal(post.counters.likeCount, 2);
});

test('togglePostInteraction never lets a counter become negative', () => {
  const bookmarked = { ...post, interactions: { ...post.interactions, isBookmarked: true } };
  const updated = togglePostInteraction(bookmarked, 'bookmark');
  assert.equal(updated.interactions.isBookmarked, false);
  assert.equal(updated.counters.bookmarkCount, 0);
});

test('isActivePost rejects deleted and unavailable backend tombstones', () => {
  assert.equal(isActivePost({ id: 'deleted', isDeleted: true, createdAt: '' }), false);
  assert.equal(isActivePost({ id: 'hidden', isUnavailable: true, createdAt: '' }), false);
  assert.equal(isActivePost(post), true);
});
