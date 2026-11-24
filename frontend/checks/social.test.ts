import assert from "node:assert/strict";
import test from "node:test";
import {
  appendPage,
  composePayload,
  createRequest,
  classifyMedia,
  mergePostChange,
  mediaPayload,
  pagePath,
  postToggle,
  repostTarget,
  resolveSocial,
  signedUpload,
  timelinePath,
} from "../src/social/model.ts";
import type { ActivePost } from "../src/social/model.ts";

function post(id: string, fields: Partial<ActivePost> = {}): ActivePost {
  return {
    id,
    isDeleted: false,
    createdAt: "2026-11-20T12:00:00Z",
    editedAt: null,
    content: "Chào bạn",
    visibility: "PUBLIC",
    parentId: null,
    rootId: null,
    repostOfId: null,
    quotedPostId: null,
    author: { id: "a", username: "hoa", displayName: "Hoa" },
    media: [],
    counters: {
      likeCount: 7,
      replyCount: 0,
      repostCount: 22,
      quoteCount: 0,
      bookmarkCount: 0,
    },
    interactions: { isLiked: false, isReposted: false, isBookmarked: false },
    ...fields,
  };
}

test("public discovery and authenticated home resolve to different feeds", () => {
  assert.equal(resolveSocial("/", true).endpoint, "/posts/feed");
  assert.equal(resolveSocial("/", false).endpoint, "/posts/explore");
  assert.equal(resolveSocial("/likes", true).endpoint, "/posts/liked");
  assert.equal(resolveSocial("/bookmarks", false).requiresUser, true);
});

test("search trims Vietnamese terms, preserves the media filter and rejects short terms", () => {
  assert.equal(
    resolveSocial("/search?q=%20c%C3%A0+ph%C3%AA%20&mediaOnly=true", false)
      .endpoint,
    "/posts/search?q=c%C3%A0+ph%C3%AA&mediaOnly=true",
  );
  assert.equal(
    resolveSocial("/search?q=a&mediaOnly=1", true).endpoint,
    undefined,
  );
  assert.equal(
    resolveSocial("/search?q=" + "a".repeat(101), true).endpoint,
    undefined,
  );
});

test("encoded post links and opaque cursors round-trip without losing filters", () => {
  assert.equal(resolveSocial("/posts/a%2Bb", true).postId, "a+b");
  const path = pagePath("/posts/explore?mediaOnly=true", "X/+ =");
  const url = new URL(path, "https://local.test");
  assert.equal(url.searchParams.get("cursor"), "X/+ =");
  assert.equal(url.searchParams.get("limit"), "20");
  assert.equal(url.searchParams.get("mediaOnly"), "true");
});

test("overlapping pages append new posts once without rolling back visible data", () => {
  assert.deepEqual(
    appendPage(
      [post("a", { content: "Đã sửa" })],
      [post("a"), post("b"), post("b")],
    ).map((item) => [
      item.id,
      item.isDeleted || item.isUnavailable ? null : item.content,
    ]),
    [
      ["a", "Đã sửa"],
      ["b", "Chào bạn"],
    ],
  );
});

test("repost rows target the original and update its embedded interaction state", () => {
  const original = post("original", {
    counters: { ...post("x").counters, likeCount: 0 },
  });
  const wrapper = post("repost", {
    repostOfId: original.id,
    repostOf: original,
  });
  assert.equal(repostTarget(wrapper)?.id, "original");
  assert.equal(repostTarget({ ...wrapper, repostOf: null }), undefined);
  const merged = mergePostChange(wrapper, {
    id: original.id,
    kind: "toggle",
    action: "like",
    active: true,
    count: 3,
  });
  assert.equal(merged && repostTarget(merged)?.counters.likeCount, 3);
});

test("toggle requests follow the current flag and undo without negative counts", () => {
  const current = post("a/b", {
    interactions: { isLiked: true, isReposted: false, isBookmarked: false },
    counters: { ...post("x").counters, likeCount: 0 },
  });
  assert.deepEqual(postToggle(current, "like"), {
    path: "/posts/a%2Fb/like",
    method: "DELETE",
    active: false,
  });
  assert.deepEqual(postToggle(current, "bookmark"), {
    path: "/posts/a%2Fb/bookmark",
    method: "POST",
    active: true,
  });
  const updated = mergePostChange(current, {
    id: current.id,
    kind: "toggle",
    action: "like",
    active: false,
  });
  assert.ok(updated && !updated.isDeleted && !updated.isUnavailable);
  assert.equal(updated.counters.likeCount, 0);
  assert.equal(updated.interactions.isLiked, false);
});

test("delete keeps thread tombstones and prevents deleted text from surviving as a quote", () => {
  const source = post("a", {
    counters: { ...post("x").counters, replyCount: 2 },
  });
  const quote = post("b", { quotedPostId: source.id, quotedPost: source });
  const removal = { id: source.id, kind: "delete" as const };
  assert.equal(mergePostChange(source, removal), null);
  assert.deepEqual(mergePostChange(source, removal, true), {
    id: "a",
    isDeleted: true,
    createdAt: source.createdAt,
    replyCount: 2,
  });
  const merged = mergePostChange(quote, removal);
  assert.ok(merged && !merged.isDeleted && !merged.isUnavailable);
  assert.equal(merged.quotedPost, null);
  assert.equal(merged.isQuotedPostDeleted, true);
});

test("upload targets Cloudinary with the signed fields and maps the response to the post DTO", () => {
  const file = new File(["video"], "ghi-am.mp3", { type: "audio/mpeg" });
  const attempt = signedUpload(file, {
    cloudName: "demo",
    resourceType: "video",
    apiKey: "public",
    folder: "mxh/a/posts",
    timestamp: 42,
    signature: "request-signature",
  });
  assert.equal(
    attempt.url,
    "https://api.cloudinary.com/v1_1/demo/video/upload",
  );
  assert.deepEqual(
    [...attempt.body.keys()],
    ["file", "api_key", "timestamp", "signature", "folder"],
  );
  assert.equal(attempt.body.get("signature"), "request-signature");
  const media = mediaPayload(
    {
      public_id: "mxh/a/posts/clip",
      version: 123,
      signature: "response-signature",
      duration: 2.5,
    },
    "audio",
    1,
  );
  assert.deepEqual(media, {
    publicId: "mxh/a/posts/clip",
    version: "123",
    signature: "response-signature",
    type: "AUDIO",
    duration: 2.5,
    order: 1,
  });
  assert.throws(() =>
    mediaPayload({ public_id: "clip", version: 123 }, "audio", 0),
  );
});

test("attachment validation enforces supported types and image size", () => {
  assert.equal(
    classifyMedia({ name: "photo.png", type: "image/png", size: 100 }),
    "image",
  );
  assert.equal(
    classifyMedia({ name: "CLIP.MOV", type: "", size: 100 }),
    "video",
  );
  assert.throws(() =>
    classifyMedia({
      name: "huge.png",
      type: "image/png",
      size: 10 * 1024 * 1024 + 1,
    }),
  );
  assert.throws(() =>
    classifyMedia({ name: "fake.png", type: "text/html", size: 7 }),
  );
});

test("composer produces separate reply and quote bodies and permits valid media-only posts", () => {
  const media = mediaPayload(
    { public_id: "m", version: "3", signature: "s" },
    "image",
    0,
  );
  assert.deepEqual(composePayload("  ", "PRIVATE", [media], {}), {
    visibility: "PRIVATE",
    media: [media],
  });
  assert.deepEqual(
    composePayload(" Xin chào ", "FOLLOWERS", [], { parentId: "p" }),
    {
      content: "Xin chào",
      visibility: "FOLLOWERS",
      parentId: "p",
    },
  );
  assert.deepEqual(
    composePayload("Góc nhìn mới", "PUBLIC", [], { quotedPostId: "q" }),
    {
      content: "Góc nhìn mới",
      visibility: "PUBLIC",
      quotedPostId: "q",
    },
  );
  assert.throws(
    () => composePayload("", "PUBLIC", [], { quotedPostId: "q" }),
    /nội dung|tệp/,
  );
  assert.throws(() => composePayload(" ", "PUBLIC", [], { parentId: "p" }));
});

test("create retries reuse an idempotency key only for the same post body", () => {
  const body = composePayload("Chào", "PUBLIC", [], {});
  const first = createRequest(body, null, () => "first");
  assert.equal(createRequest({ ...body }, first, () => "unused").key, "first");
  assert.equal(
    createRequest({ ...body, visibility: "PRIVATE" }, first, () => "second")
      .key,
    "second",
  );
});

test("the embedded profile timeline keeps the encoded username in both endpoint variants", () => {
  assert.equal(timelinePath("hoa+lan"), "/users/hoa%2Blan/posts");
  assert.equal(
    pagePath(timelinePath("hoa+lan", true), null),
    "/users/hoa%2Blan/replies?limit=20",
  );
});

test("visibility changes hide non-public sources from loaded reposts and quotes", () => {
  const source = post("source");
  const change = {
    id: source.id,
    kind: "edit" as const,
    post: { ...source, visibility: "FOLLOWERS" as const },
  };
  const repost = mergePostChange(
    post("repost", { repostOfId: source.id, repostOf: source }),
    change,
  );
  assert.ok(repost);
  assert.equal(repostTarget(repost), undefined);
  const quote = mergePostChange(
    post("quote", { quotedPostId: source.id, quotedPost: source }),
    change,
  );
  assert.ok(quote && !quote.isDeleted && !quote.isUnavailable);
  assert.equal(quote.quotedPost, null);
});

test("reply edit payloads omit visibility because backend rejects it", async () => {
  const { editPayload } = await import("../src/social/model.ts");
  assert.deepEqual(
    editPayload({ parentId: "parent" }, "Sửa reply", "PRIVATE"),
    {
      content: "Sửa reply",
    },
  );
  assert.deepEqual(editPayload({ parentId: null }, "Sửa bài", "PRIVATE"), {
    content: "Sửa bài",
    visibility: "PRIVATE",
  });
});
