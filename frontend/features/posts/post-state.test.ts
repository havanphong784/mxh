import assert from "node:assert/strict";
import test from "node:test";

import type { ActivePostItem } from "../../types/api.ts";
import {
  isActivePost,
  restorePostInteraction,
  togglePostInteraction,
  updatePostTree,
} from "./post-state.ts";

const post = {
  id: "p1",
  interactions: { isLiked: false, isReposted: false, isBookmarked: false },
  counters: {
    likeCount: 2,
    repostCount: 1,
    bookmarkCount: 0,
    replyCount: 0,
    quoteCount: 0,
  },
} as ActivePostItem;

test("togglePostInteraction changes like state and count without mutating the source", () => {
  const updated = togglePostInteraction(post, "like");
  assert.equal(updated.interactions.isLiked, true);
  assert.equal(updated.counters.likeCount, 3);
  assert.equal(post.interactions.isLiked, false);
  assert.equal(post.counters.likeCount, 2);
});

test("togglePostInteraction never lets a counter become negative", () => {
  const bookmarked = {
    ...post,
    interactions: { ...post.interactions, isBookmarked: true },
  };
  const updated = togglePostInteraction(bookmarked, "bookmark");
  assert.equal(updated.interactions.isBookmarked, false);
  assert.equal(updated.counters.bookmarkCount, 0);
});

test("isActivePost rejects deleted and unavailable backend tombstones", () => {
  assert.equal(
    isActivePost({ id: "deleted", isDeleted: true, createdAt: "" }),
    false,
  );
  assert.equal(
    isActivePost({ id: "hidden", isUnavailable: true, createdAt: "" }),
    false,
  );
  assert.equal(isActivePost(post), true);
});

test("failed like rollback preserves another successful optimistic action", () => {
  const posts = [post, { ...post, id: "p2" }];
  const withLike = updatePostTree(posts, "p1", "like");
  const withBookmark = updatePostTree(withLike, "p2", "bookmark");
  const restored = restorePostInteraction(
    withBookmark,
    "p1",
    "like",
    false,
  ) as ActivePostItem[];

  assert.equal(restored[0].interactions.isLiked, false);
  assert.equal(restored[0].counters.likeCount, 2);
  assert.equal(restored[1].interactions.isBookmarked, true);
  assert.equal(restored[1].counters.bookmarkCount, 1);
});
