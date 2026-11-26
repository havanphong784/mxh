import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Temporal } from "@js-temporal/polyfill";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { EventsGateway } from "../gateway/events.gateway.js";
import type { MessageMediaService } from "./message-media.service.js";
import type {
  ConversationWithParticipants,
  MessageRecord,
  MessagingRepository,
} from "./messaging.repository.js";
import { MessagingService } from "./messaging.service.js";

function createService(
  repository: Partial<MessagingRepository>,
  gateway: Pick<EventsGateway, "pushToUser"> = {
    pushToUser() {
      assert.fail("Unexpected realtime event");
    },
  },
  media?: MessageMediaService,
) {
  // Each test supplies only the methods it exercises; their signatures stay checked.
  return new MessagingService(
    { findMediaForMessages: async () => new Map(), ...repository } as MessagingRepository,
    gateway as EventsGateway,
    media!,
  );
}

const now = Temporal.Instant.from("2026-11-06T00:00:00Z");

function user(id: string): ConversationWithParticipants["participants"][number]["user"] {
  return {
    id,
    username: id,
    displayName: id,
    avatarUrl: null,
    bio: null,
    email: `${id}@example.test`,
    passwordHash: "test-password-hash",
    avatarPublicId: null,
    bannerUrl: null,
    bannerPublicId: null,
    isActive: true,
    isEmailVerified: true,
    createdAt: now,
    updatedAt: now,
  };
}

function conversationFixture(): ConversationWithParticipants {
  return {
    id: "conversation-1",
    type: "DIRECT",
    directKey: "user-a:user-b",
    createdAt: now,
    updatedAt: now,
    participants: [
      {
        conversationId: "conversation-1",
        userId: "user-a",
        lastReadAt: null,
        joinedAt: now,
        user: user("user-a"),
      },
      {
        conversationId: "conversation-1",
        userId: "user-b",
        lastReadAt: null,
        joinedAt: now,
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
  const service = createService(repository);

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

test("typing resolves only the peer for an existing conversation member", async () => {
  const conversation = conversationFixture();
  const service = createService({
    findParticipant: async (_id, userId) =>
      conversation.participants.find((item) => item.userId === userId) ?? null,
    findConversationWithParticipants: async () => conversation,
  });
  assert.equal(await service.getTypingRecipient("user-a", conversation.id), "user-b");
  await assert.rejects(service.getTypingRecipient("outsider", conversation.id), ForbiddenException);
});

test("users outside a conversation cannot send messages", async () => {
  const repository = {
    findParticipant: async () => null,
  };
  const service = createService(repository);

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
    listConversations: async (_userId: string, limit: number, cursor?: unknown) => {
      receivedLimit = limit;
      receivedCursor = cursor;
      return { items: [conversation], hasMore: true };
    },
    findLatestMessages: async (ids: string[]) => {
      assert.deepEqual(ids, [conversation.id]);
      return [];
    },
    countUnreadForConversations: async (ids: string[], userId: string) => {
      assert.deepEqual(ids, [conversation.id]);
      assert.equal(userId, "user-a");
      return new Map([[conversation.id, 0]]);
    },
  };
  const service = createService(repository);
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
      userId === "user-a" ? { conversation, participant: conversation.participants[0] } : null,
    findLatestMessage: async () => null,
    countUnreadForConversation: async () => 0,
  };
  const service = createService(repository);

  const detail = await service.getConversation("user-a", conversation.id);
  assert.equal(detail.participant.id, "user-b");
  await assert.rejects(
    service.getConversation("outsider", conversation.id),
    (error: unknown) => error instanceof NotFoundException,
  );
});

test("retrying a client message returns the existing message and emits only once", async () => {
  const message: MessageRecord = {
    id: "message-1",
    conversationId: "conversation-1",
    senderId: "user-a",
    clientMessageId: "client-1",
    type: "TEXT",
    body: "hello",
    createdAt: now,
    editedAt: null,
    deletedAt: null,
  };
  let existing = false;
  const pushed: string[] = [];
  const repository = {
    findParticipant: async () => conversationFixture().participants[0],
    findMessageByClientId: async () => (existing ? message : null),
    createMessage: async () => {
      existing = true;
      return { message, created: true };
    },
    findConversationWithParticipants: async () => conversationFixture(),
    countAllUnreadForUser: async () => 1,
  };
  const gateway = {
    pushToUser: (_userId: string, event: string) => pushed.push(event),
  };
  const service = createService(repository, gateway);

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
  const message: MessageRecord = {
    id: "message-1",
    conversationId: "conversation-1",
    senderId: "user-a",
    clientMessageId: "client-1",
    type: "TEXT",
    body: "hello",
    createdAt: now,
    editedAt: null,
    deletedAt: null,
  };
  const pushed: string[] = [];
  const repository = {
    findParticipant: async () => conversationFixture().participants[0],
    findMessageByClientId: async () => null,
    createMessage: async () => ({ message, created: false }),
    findConversationWithParticipants: async () => conversationFixture(),
    countAllUnreadForUser: async () => 1,
  };
  const gateway = {
    pushToUser: (_userId: string, event: string) => pushed.push(event),
  };
  const service = createService(repository, gateway);

  const result = await service.sendMessage("user-a", "conversation-1", {
    body: "hello",
    clientMessageId: "client-1",
  });

  assert.equal(result.id, message.id);
  assert.deepEqual(pushed, []);
});

test("expired image reservations tell the sender to upload again", async () => {
  const failure = new BadRequestException("Ảnh đã hết hạn, vui lòng chọn và tải lại ảnh");
  const service = createService(
    {
      findParticipant: async () => conversationFixture().participants[0],
      findMessageByClientId: async () => null,
      createMessage: async () => {
        throw failure;
      },
    },
    undefined,
    { verify: async () => [] } as unknown as MessageMediaService,
  );
  await assert.rejects(
    service.sendMessage("user-a", "conversation-1", {
      clientMessageId: "expired-image",
      media: [{ publicId: "mxh/user-a/messages/expired", version: 1, signature: "fixture" }],
    }),
    (error: unknown) => error === failure,
  );
});

test("image-only messages keep verified media and retry without verifying or emitting again", async () => {
  const media = [
    {
      id: "media-1",
      messageId: "message-1",
      publicId: "mxh/user-a/messages/a",
      url: "https://example.test/a.png",
      width: 10,
      height: 10,
      format: "png",
      bytes: 100,
      order: 0,
    },
  ];
  let stored: MessageRecord | null = null;
  let verified = 0;
  const pushed: string[] = [];
  const service = createService(
    {
      findParticipant: async () => conversationFixture().participants[0],
      findMessageByClientId: async () => stored,
      findMediaForMessages: async () => new Map([["message-1", media]]),
      createMessage: async (data) => {
        assert.equal(data.body, "");
        assert.equal(data.media?.[0].publicId, "mxh/user-a/messages/a");
        stored = {
          id: "message-1",
          conversationId: "conversation-1",
          senderId: "user-a",
          clientMessageId: "client-image",
          type: "IMAGE",
          body: "",
          createdAt: now,
          editedAt: null,
          deletedAt: null,
        };
        return { message: stored, created: true };
      },
      findConversationWithParticipants: async () => conversationFixture(),
      countAllUnreadForUser: async () => 1,
    },
    {
      pushToUser: (_id, event) => {
        pushed.push(event);
      },
    },
    {
      verify: async () => {
        verified++;
        return media;
      },
    } as unknown as MessageMediaService,
  );
  const request = {
    clientMessageId: "client-image",
    media: [{ publicId: media[0].publicId, version: 123, signature: "verified-by-test-adapter" }],
  };
  const first = await service.sendMessage("user-a", "conversation-1", request);
  const second = await service.sendMessage("user-a", "conversation-1", request);
  assert.equal(first.type, "IMAGE");
  assert.deepEqual(first.media, second.media);
  assert.equal(first.media.length, 1);
  assert.equal(verified, 1);
  assert.equal(pushed.filter((event) => event === "conversation:new-message").length, 2);
});
