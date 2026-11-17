import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ConversationListProps } from "./ConversationList.tsx";
import type { ConversationItem } from "../../../types/api.ts";

const require = createRequire(import.meta.url);
const conversation: ConversationItem = {
  id: "conversation-1",
  type: "DIRECT",
  participant: {
    id: "user-b",
    username: "user-b",
    displayName: "User B",
    avatarUrl: null,
    bio: null,
  },
  lastMessage: null,
  unreadCount: 0,
  updatedAt: "2026-11-17T12:00:00Z",
};

async function renderConversationList(overrides: Record<string, unknown> = {}) {
  const bundle = await build({
    entryPoints: [new URL("./ConversationList.tsx", import.meta.url).pathname],
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    tsconfig: new URL("../../../tsconfig.json", import.meta.url).pathname,
    external: ["react", "react-dom", "next/*"],
  });
  const loaded = {
    exports: {} as {
      ConversationList: React.ComponentType<ConversationListProps>;
    },
  };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(
    require,
    loaded,
    loaded.exports,
  );

  return renderToStaticMarkup(
    React.createElement(loaded.exports.ConversationList, {
      conversations: [],
      activeConversationId: null,
      onSelect: () => undefined,
      isLoading: false,
      error: null,
      onRetry: () => undefined,
      hasNextPage: false,
      isFetchingNextPage: false,
      isFetchNextPageError: false,
      fetchNextPage: () => undefined,
      ...overrides,
    }),
  );
}

test("conversation list distinguishes loading from an empty inbox", async () => {
  const html = await renderConversationList({ isLoading: true });

  assert.match(html, /Đang tải danh sách trò chuyện/);
  assert.doesNotMatch(html, /Chưa có cuộc trò chuyện nào/);
});

test("conversation list exposes retry and pagination actions", async () => {
  const html = await renderConversationList({
    conversations: [conversation],
    error: "Không thể tải danh sách",
    hasNextPage: true,
  });

  assert.match(html, /role="alert"/);
  assert.match(html, /Không thể tải danh sách/);
  assert.match(html, /Tải thêm cuộc trò chuyện/);
  assert.match(html, /User B/);
});

test("a failed conversation page offers an explicit retry", async () => {
  const html = await renderConversationList({
    hasNextPage: true,
    isFetchNextPageError: true,
  });

  assert.match(html, /Thử tải lại/);
  assert.doesNotMatch(html, /Tải thêm cuộc trò chuyện/);
});
