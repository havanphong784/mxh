import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { createOrmTestClient } from "../testing/orm-test-client.js";
import { PostResponseMapper } from "./dto/post-response.dto.js";
import { PostsRepository } from "./posts.repository.js";

const author = {
  id: "author",
  username: "author",
  displayName: "Author",
  isActive: true,
  isEmailVerified: true,
};
const original = {
  id: "original",
  authorId: "author",
  content: "Original",
  visibility: "PUBLIC",
  isDeleted: false,
};

function findProjection(value: unknown, alias: string): unknown {
  if (!value || typeof value !== "object") return undefined;
  const node = value as Record<string, unknown>;
  if (node.kind === "projection-item" && node.alias === alias) return node;
  for (const child of Object.values(node)) {
    const found = findProjection(child, alias);
    if (found) return found;
  }
  return undefined;
}

// The fake driver supplies only the relations requested by the compiled include.
function includedRow(plan: { ast: unknown }, nestedRepost = false) {
  const scope = nestedRepost ? findProjection(plan.ast, "repostOf") : plan.ast;
  const quote = findProjection(scope, "quotedPost");
  const quotedPost = {
    ...original,
    ...(findProjection(quote, "author") ? { author: [author] } : {}),
    ...(findProjection(quote, "media")
      ? {
          media: [
            {
              id: "image",
              publicId: "asset",
              url: "https://example.test/image",
              type: "IMAGE",
              order: 0,
            },
          ],
        }
      : {}),
  };
  const post = {
    id: "quote",
    authorId: "author",
    author: [author],
    visibility: "PUBLIC",
    isDeleted: false,
    quotedPostId: "original",
    quotedPost: [quotedPost],
    media: [],
    repostOf: [],
  };
  return nestedRepost
    ? {
        ...post,
        id: "repost",
        quotedPostId: null,
        quotedPost: [],
        repostOfId: "quote",
        repostOf: [post],
      }
    : post;
}

test("root visibility changes update all replies without selecting one reply identity", async () => {
  const { prisma, plans } = createOrmTestClient({
    query: () => [{ id: "root" }],
    execute: () => 3,
  });
  await new PostsRepository(prisma).updatePostAndReplies(
    "root",
    { visibility: "PRIVATE" },
    "PRIVATE",
  );
  const bulk = plans.filter(
    (plan) => plan.ast.kind === "update" && JSON.stringify(plan.ast).includes('"column":"rootId"'),
  );
  assert.ok(bulk.length >= 1);
  assert.ok(bulk.some((plan) => plan.params.includes("root")));
  assert.equal(
    plans.filter(
      (plan) =>
        plan.ast.kind === "select" && JSON.stringify(plan.ast).includes('"column":"rootId"'),
    ).length,
    0,
  );
});

test("tombstone cleanup deletes every media, like, bookmark and repost row", async () => {
  const { prisma, plans } = createOrmTestClient({
    query: (plan) =>
      JSON.stringify(plan.ast).includes('"alias":"total"') ? [{ total: 1 }] : [{ id: "post" }],
    execute: () => 4,
  });
  await new PostsRepository(prisma).deletePostRecord("post", {
    parentId: null,
    quotedPostId: null,
    repostOfId: null,
  });
  const deletions = plans.filter((plan) => plan.ast.kind === "delete");
  assert.equal(deletions.length, 4);
  for (const [index, column] of ["postId", "postId", "postId", "repostOfId"].entries()) {
    assert.match(JSON.stringify(deletions[index].ast), new RegExp(`"column":"${column}"`));
    assert.ok(deletions[index].params.includes("post"));
  }
  assert.equal(
    plans.filter(
      (plan) =>
        plan.ast.kind === "select" && JSON.stringify(plan.ast).includes('"column":"postId"'),
    ).length,
    0,
  );
});

for (const method of [
  "findByIdForResponse",
  "findPostsByIdsForResponse",
  "listReplies",
  "listFeedPosts",
  "listExplorePosts",
  "listUserPosts",
  "listUserReplies",
  "createPostWithMedia",
] as const) {
  test(`${method} loads quoted author and media with the actual ORM`, async () => {
    const { prisma } = createOrmTestClient({
      query: (plan) => (plan.ast.kind === "insert" ? [{ id: "quote" }] : [includedRow(plan)]),
    });
    const repo = new PostsRepository(prisma);
    let result: Awaited<ReturnType<PostsRepository["findByIdForResponse"]>>;
    switch (method) {
      case "findByIdForResponse":
        result = await repo.findByIdForResponse("quote");
        break;
      case "findPostsByIdsForResponse":
        result = (await repo.findPostsByIdsForResponse(["quote"]))[0];
        break;
      case "listReplies":
        result = (await repo.listReplies("parent", 20))[0];
        break;
      case "listFeedPosts":
        result = (await repo.listFeedPosts(["author"], 20))[0];
        break;
      case "listExplorePosts":
        result = (await repo.listExplorePosts(20, null))[0];
        break;
      case "listUserPosts":
        result = (await repo.listUserPosts("author", ["PUBLIC"], 20))[0];
        break;
      case "listUserReplies":
        result = (await repo.listUserReplies("author", 20))[0];
        break;
      case "createPostWithMedia":
        result = await repo.createPostWithMedia({
          authorId: "author",
          content: "Quote",
          visibility: "PUBLIC",
          parentId: null,
          rootId: null,
          quotedPostId: "original",
          media: [],
        });
        break;
    }
    assert.ok(result);
    const response = PostResponseMapper.fromEntity(result);
    assert.ok(!response.isDeleted && !response.isUnavailable);
    assert.equal(response.isQuotedPostDeleted, false);
    assert.equal(response.quotedPost?.author?.id, "author");
    assert.equal(response.quotedPost?.media[0]?.id, "image");
  });
}

test("a repost of a quote also loads the quoted author and media", async () => {
  const { prisma } = createOrmTestClient({ query: (plan) => [includedRow(plan, true)] });
  const post = await new PostsRepository(prisma).findByIdForResponse("repost");
  const response = PostResponseMapper.fromEntity(post);
  assert.ok(!response.isDeleted && !response.isUnavailable);
  const reposted = response.repostOf;
  assert.ok(reposted && !reposted.isDeleted && !reposted.isUnavailable);
  assert.equal(reposted.quotedPost?.author?.id, "author");
  assert.equal(reposted.quotedPost?.media[0]?.id, "image");
});
