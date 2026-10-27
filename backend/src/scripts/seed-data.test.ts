import assert from 'node:assert/strict';
import { buildSeedData } from './seed-data.js';

const data = buildSeedData(new Date('2026-10-26T00:00:00.000Z'));
const again = buildSeedData(new Date('2026-10-26T00:00:00.000Z'));
assert.deepEqual(data, again, 'Seed phải ổn định khi chạy lại');

assert.ok(data.users.length >= 18);
assert.ok(data.posts.length >= 90);
assert.ok(data.follows.length >= 40);
assert.ok(data.likes.length >= 100);
assert.ok(data.bookmarks.length >= 30);
assert.ok(data.notifications.length >= 30);
assert.ok(data.sessions.some((item) => item.isRevoked));
assert.ok(data.sessions.some((item) => item.expiresAt < new Date('2026-10-26T00:00:00.000Z')));
assert.ok(data.otpCodes.some((item) => item.type === 'REGISTER_VERIFY'));
assert.ok(data.otpCodes.some((item) => item.type === 'FORGOT_PASSWORD'));

const userIds = new Set(data.users.map((user) => user.id));
const postIds = new Set(data.posts.map((post) => post.id));
assert.equal(userIds.size, data.users.length);
assert.equal(postIds.size, data.posts.length);
assert.ok(data.users.some((user) => !user.isEmailVerified));
assert.ok(data.users.some((user) => !user.isActive));
assert.ok(data.users.some((user) => !user.bio && !user.avatarUrl));

const visibilities = new Set(data.posts.map((post) => post.visibility));
assert.deepEqual(visibilities, new Set(['PUBLIC', 'FOLLOWERS', 'PRIVATE']));
assert.ok(data.posts.some((post) => post.isDeleted && data.posts.some((reply) => reply.parentId === post.id)));
assert.ok(data.posts.some((post) => post.parentId && post.rootId && post.parentId !== post.rootId));
assert.ok(data.posts.some((post) => post.parentId && post.visibility === 'FOLLOWERS'));
assert.ok(data.posts.some((post) => post.repostOfId));
assert.ok(data.posts.some((post) => post.quotedPostId));
assert.ok(data.posts.some((post) => post.editedAt));
assert.ok(data.media.some((item) => item.type === 'IMAGE'));
assert.ok(data.media.some((item) => item.type === 'VIDEO'));
assert.ok(data.media.some((item) => item.order > 0));

for (const post of data.posts) {
  assert.ok(userIds.has(post.authorId));
  for (const id of [post.parentId, post.rootId, post.repostOfId, post.quotedPostId]) {
    if (id) assert.ok(postIds.has(id), `${post.id} tham chiếu bài không tồn tại`);
  }
  assert.equal(post.likeCount, data.likes.filter((item) => item.postId === post.id).length);
  assert.equal(post.bookmarkCount, data.bookmarks.filter((item) => item.postId === post.id).length);
  assert.equal(post.replyCount, data.posts.filter((item) => item.parentId === post.id && !item.isDeleted).length);
  assert.equal(post.repostCount, data.posts.filter((item) => item.repostOfId === post.id && !item.isDeleted).length);
  assert.equal(post.quoteCount, data.posts.filter((item) => item.quotedPostId === post.id && !item.isDeleted).length);
  if (post.parentId) {
    const parent = data.posts.find((item) => item.id === post.parentId)!;
    assert.ok(post.createdAt >= parent.createdAt, 'Trả lời không được có trước bài gốc');
    assert.equal(post.visibility, parent.visibility, 'Trả lời phải kế thừa quyền xem');
    if (parent.visibility === 'PRIVATE') assert.equal(post.authorId, parent.authorId, 'Chỉ tác giả được trả lời bài riêng tư');
    if (parent.visibility === 'FOLLOWERS' && post.authorId !== parent.authorId) {
      assert.ok(data.follows.some((follow) => follow.followerId === post.authorId && follow.followingId === parent.authorId), 'Người trả lời phải theo dõi tác giả của thread');
    }
  }
}

for (const follow of data.follows) {
  assert.ok(userIds.has(follow.followerId) && userIds.has(follow.followingId));
  assert.notEqual(follow.followerId, follow.followingId);
}
for (const item of [...data.likes, ...data.bookmarks]) {
  assert.ok(userIds.has(item.userId) && postIds.has(item.postId));
  assert.ok(item.createdAt >= data.posts.find((post) => post.id === item.postId)!.createdAt,
    'Tương tác không được có trước bài viết');
}
for (const item of data.notifications) {
  assert.ok(userIds.has(item.recipientId) && userIds.has(item.actorId));
  assert.notEqual(item.recipientId, item.actorId);
  if (item.postId) {
    const post = data.posts.find((candidate) => candidate.id === item.postId)!;
    assert.ok(postIds.has(item.postId));
    assert.ok(item.createdAt >= post.createdAt, 'Thông báo không được có trước bài liên quan');
  }
}
assert.deepEqual(new Set(data.notifications.map((item) => item.type)), new Set(['LIKE', 'REPLY', 'REPOST', 'QUOTE', 'FOLLOW']));
assert.ok(data.notifications.some((item) => item.isRead));
assert.ok(data.notifications.some((item) => !item.isRead));

console.log('Seed fixture coverage and integrity: OK');
