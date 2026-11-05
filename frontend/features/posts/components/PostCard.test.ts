import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ActivePostItem } from "../../../types/api.ts";

const require = createRequire(import.meta.url);

async function renderPost(post: ActivePostItem) {
  const bundle = await build({
    entryPoints: [new URL("./PostCard.tsx", import.meta.url).pathname],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    tsconfig: new URL("../../../tsconfig.json", import.meta.url).pathname,
    external: ["react", "react-dom", "next/*"],
  });
  const loaded = {
    exports: {} as { PostCard: React.ComponentType<{ post: ActivePostItem }> },
  };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(
    require,
    loaded,
    loaded.exports,
  );
  return renderToStaticMarkup(
    React.createElement(loaded.exports.PostCard, { post }),
  );
}

test("a pure repost shows the original author's content", async () => {
  const original = {
    id: "original",
    content: "Nội dung bài gốc",
    visibility: "PUBLIC",
    parentId: null,
    rootId: null,
    repostOfId: null,
    quotedPostId: null,
    isDeleted: false,
    editedAt: null,
    createdAt: "2026-11-05T00:00:00Z",
    author: {
      id: "author",
      username: "author",
      displayName: "Tác giả",
      avatarUrl: null,
    },
    media: [],
    counters: {
      likeCount: 0,
      replyCount: 0,
      repostCount: 0,
      quoteCount: 0,
      bookmarkCount: 0,
    },
    interactions: { isLiked: false, isReposted: false, isBookmarked: false },
  } satisfies ActivePostItem;
  const repost = {
    ...original,
    id: "repost",
    content: null,
    repostOfId: original.id,
    repostOf: original,
    author: {
      id: "reposter",
      username: "reposter",
      displayName: "Người chia sẻ",
      avatarUrl: null,
    },
  } as ActivePostItem;

  const html = await renderPost(repost);

  assert.match(html, /Nội dung bài gốc/);
  assert.match(html, /Tác giả/);
});
