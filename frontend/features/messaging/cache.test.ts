import assert from "node:assert/strict";
import { test } from "node:test";
import { replaceMessage, upsertConversation, upsertMessage } from "./cache.ts";
import type { MessageItem } from "../../types/api.ts";

const baseMessage: MessageItem = {
  id: "message-1",
  conversationId: "conversation-1",
  senderId: "user-a",
  clientMessageId: "client-1",
  type: "TEXT",
  body: "hello",
  createdAt: "2026-11-06T00:00:00.000Z",
  editedAt: null,
  deletedAt: null,
};

test("message cache replaces an optimistic message without duplicates", () => {
  const cached = {
    pages: [
      {
        data: [
          { ...baseMessage, id: "local:client-1", status: "sending" as const },
        ],
        nextCursor: null,
        hasMore: false,
      },
    ],
    pageParams: [null],
  };
  const result = replaceMessage(cached, "client-1", baseMessage);
  assert.equal(result?.pages[0].data.length, 1);
  assert.equal(result?.pages[0].data[0].id, "message-1");
  assert.equal(result?.pages[0].data[0].status, undefined);
});

test("message cache deduplicates realtime events by server id and client id", () => {
  const cached = {
    pages: [{ data: [baseMessage], nextCursor: null, hasMore: false }],
    pageParams: [null],
  };
  const result = upsertMessage(cached, { ...baseMessage, body: "updated" });
  assert.equal(result?.pages[0].data.length, 1);
  assert.equal(result?.pages[0].data[0].body, "updated");
});

test("new realtime messages stay on the newest page after older pages are loaded", () => {
  const olderMessage = {
    ...baseMessage,
    id: "message-old",
    clientMessageId: "client-old",
    createdAt: "2026-11-05T23:00:00.000Z",
  };
  const newestMessage = {
    ...baseMessage,
    id: "message-new",
    clientMessageId: "client-new",
    createdAt: "2026-11-06T00:00:00.000Z",
  };
  const incoming = {
    ...baseMessage,
    id: "message-incoming",
    clientMessageId: "client-incoming",
    createdAt: "2026-11-06T00:01:00.000Z",
  };

  const result = upsertMessage(
    {
      pages: [
        { data: [newestMessage], nextCursor: "older", hasMore: true },
        { data: [olderMessage], nextCursor: null, hasMore: false },
      ],
      pageParams: [null, "older"],
    },
    incoming,
  );

  assert.deepEqual(
    result?.pages[0].data.map((message) => message.id),
    ["message-new", "message-incoming"],
  );
  assert.deepEqual(
    result?.pages[1].data.map((message) => message.id),
    ["message-old"],
  );
});

test("messages from different senders are not deduplicated by a colliding client id", () => {
  const otherSenderMessage = {
    ...baseMessage,
    id: "message-other",
    senderId: "user-b",
  };
  const result = upsertMessage(
    {
      pages: [{ data: [baseMessage], nextCursor: null, hasMore: false }],
      pageParams: [null],
    },
    otherSenderMessage,
  );

  assert.equal(result?.pages[0].data.length, 2);
  assert.deepEqual(
    result?.pages[0].data.map((message) => message.senderId),
    ["user-a", "user-b"],
  );
});

test("a direct-opened conversation initializes an empty conversation cache", () => {
  const conversation = {
    id: "conversation-new",
    type: "DIRECT" as const,
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

  const result = upsertConversation(undefined, conversation);

  assert.deepEqual(result?.pages[0]?.data, [conversation]);
  assert.deepEqual(result?.pageParams, [null]);
});
