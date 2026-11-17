import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Temporal } from "@js-temporal/polyfill";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { MessagingService } from "./messaging.service.js";

const now = Temporal.Instant.from("2026-11-06T00:00:00Z");

function user(id: string) {
  return {
    id,
    username: id,
    displayName: id,
    avatarUrl: null,
    bio: null,
  };
}

function conversationFixture() {
  return {
    id: "conversation-1",
    type: "DIRECT",
    updatedAt: now,
    participants: [
      {
        conversationId: "conversation-1",
        userId: "user-a",
        lastReadAt: null,
        user: user("user-a"),
      },
      {
        conversationId: "conversation-1",
        userId: "user-b",
        lastReadAt: null,
        user: user("user-b"),
      },
    ],
  };
}

test("direct conversations are idempotent for the same pair of users", async () => {
  const conversation = conversationFixture();
  let created = 0;
  const repository = {
    findActiveUser: async (id: string) => user(id),
    findDirectConversation: async () => (created ? conversation : null),
    createDirectConversation: async () => {
      created += 1;
      return conversation;
    },
    findConversationForUser: async () => ({
      conversation,
      participant: conversation.participants[0],
    }),
    findLatestMessage: async () => null,
    countUnreadForConversation: async () => 0,
  };
  const service = new MessagingService(repository as any, {} as any);

  const first = await service.getOrCreateDirectConversation("user-b", {
    targetUserId: "user-a",
  });
  const second = await service.getOrCreateDirectConversation("user-a", {
    targetUserId: "user-b",
  });

  assert.equal(created, 1);
  assert.equal(first.id, second.id);
  assert.equal(first.participant.id, "user-a");
});

test("users outside a conversation cannot send messages", async () => {
  const repository = {
    findParticipant: async () => null,
  };
  const service = new MessagingService(repository as any, {} as any);

  await assert.rejects(
    service.sendMessage("outsider", "conversation-1", {
      body: "hello",
      clientMessageId: "client-1",
    }),
    (error: unknown) => error instanceof ForbiddenException,
  );
});

test("conversation pages are limited in the repository and include a next cursor", async () => {
  const conversation = conversationFixture();
  let receivedLimit = 0;
  let receivedCursor: unknown;
  const repository = {
    listConversations: async (
      _userId: string,
      limit: number,
      cursor?: unknown,
    ) => {
      receivedLimit = limit;
      receivedCursor = cursor;
      return { items: [conversation], hasMore: true };
    },
    findLatestMessage: async () => null,
    countUnreadForConversation: async () => 0,
  };
  const service = new MessagingService(repository as any, {} as any);
  const cursor = Buffer.from(
    JSON.stringify({
      updatedAt: "2026-11-05T00:00:00Z",
      id: "conversation-older",
    }),
  ).toString("base64");

  const page = await service.getConversations("user-a", { cursor, limit: 30 });

  assert.equal(receivedLimit, 30);
  assert.ok(receivedCursor);
  assert.equal(page.data.length, 1);
  assert.equal(page.data[0]?.id, conversation.id);
  assert.equal(page.hasMore, true);
  assert.ok(page.nextCursor);
});

test("conversation detail is only available to a participant", async () => {
  const conversation = conversationFixture();
  const repository = {
    findConversationForUser: async (_conversationId: string, userId: string) =>
      userId === "user-a"
        ? { conversation, participant: conversation.participants[0] }
        : null,
    findLatestMessage: async () => null,
    countUnreadForConversation: async () => 0,
  };
  const service = new MessagingService(repository as any, {} as any);

  const detail = await service.getConversation("user-a", conversation.id);
  assert.equal(detail.participant.id, "user-b");
  await assert.rejects(
    service.getConversation("outsider", conversation.id),
    (error: unknown) => error instanceof NotFoundException,
  );
});

test("retrying a client message returns the existing message and emits only once", async () => {
  const message = {
    id: "message-1",
    conversationId: "conversation-1",
    senderId: "user-a",
    clientMessageId: "client-1",
    body: "hello",
    createdAt: now,
    editedAt: null,
    deletedAt: null,
  };
  let existing = false;
  const pushed: string[] = [];
  const repository = {
    findParticipant: async () => ({ lastReadAt: null }),
    findMessageByClientId: async () => (existing ? message : null),
    createMessage: async () => {
      existing = true;
      return message;
    },
    findConversationWithParticipants: async () => conversationFixture(),
    countUnreadForConversation: async () => 1,
    findUnreadParticipants: async () => [
      { conversationId: "conversation-1", lastReadAt: null },
    ],
  };
  const gateway = {
    pushToUser: (_userId: string, event: string) => pushed.push(event),
  };
  const service = new MessagingService(repository as any, gateway as any);

  const first = await service.sendMessage("user-a", "conversation-1", {
    body: " hello ",
    clientMessageId: "client-1",
  });
  const second = await service.sendMessage("user-a", "conversation-1", {
    body: "hello again",
    clientMessageId: "client-1",
  });

  assert.equal(first.id, message.id);
  assert.equal(second.id, message.id);
  assert.deepEqual(pushed, [
    "conversation:new-message",
    "conversation:new-message",
    "conversation:unread-count",
  ]);
});

test("a concurrent idempotent insert does not emit a duplicate realtime event", async () => {
  const message = {
    id: "message-1",
    conversationId: "conversation-1",
    senderId: "user-a",
    clientMessageId: "client-1",
    body: "hello",
    createdAt: now,
    editedAt: null,
    deletedAt: null,
  };
  const pushed: string[] = [];
  const repository = {
    findParticipant: async () => ({ lastReadAt: null }),
    findMessageByClientId: async () => null,
    createMessage: async () => ({ message, created: false }),
    findConversationWithParticipants: async () => conversationFixture(),
    countUnreadForConversation: async () => 1,
    findUnreadParticipants: async () => [
      { conversationId: "conversation-1", lastReadAt: null },
    ],
  };
  const gateway = {
    pushToUser: (_userId: string, event: string) => pushed.push(event),
  };
  const service = new MessagingService(repository as any, gateway as any);

  const result = await service.sendMessage("user-a", "conversation-1", {
    body: "hello",
    clientMessageId: "client-1",
  });

  assert.equal(result.id, message.id);
  assert.deepEqual(pushed, []);
});
