import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { Temporal } from "@js-temporal/polyfill";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import fastifyCookie from "@fastify/cookie";
import argon2 from "argon2";
import type {
  ConversationResponseDto,
  ConversationPageDto,
  MessageResponseDto,
  MessagePageDto,
} from "./dto/messaging-response.dto.js";

// This opt-in check creates and cleans up its own fixtures in a migrated local test DB.
const databaseUrl = process.env.MESSAGING_TEST_DATABASE_URL;
if (!databaseUrl || process.env.NODE_ENV === "production") {
  throw new Error(
    "Đặt MESSAGING_TEST_DATABASE_URL trỏ tới database thử nghiệm đã chạy migration.",
  );
}
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname)
) {
  throw new Error("Kiểm thử messaging chỉ chạy với database cục bộ.");
}
process.env.DATABASE_URL = databaseUrl;
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = randomUUID() + randomUUID();
process.env.JWT_REFRESH_SECRET = randomUUID() + randomUUID();
process.env.COOKIE_SECRET = randomUUID() + randomUUID();
globalThis.Temporal = Temporal;

const { AppModule } = await import("../app.module.js");
const { PrismaService } = await import("../prisma/prisma.service.js");
const { MessagingRepository } = await import("./messaging.repository.js");
const { AllExceptionsFilter } =
  await import("../common/filters/all-exceptions.filter.js");
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  new FastifyAdapter(),
  { logger: false },
);
const createdUserIds: string[] = [];
const sockets: WebSocket[] = [];

async function connectSocket(url: string, token: string) {
  const socket = new WebSocket(
    url.replace("http://", "ws://") + "/socket.io/?EIO=4&transport=websocket",
  );
  sockets.push(socket);
  const events: Array<[string, Record<string, unknown>]> = [];
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error("WebSocket connection timed out")),
      5000,
    );
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket connection failed"));
    });
    socket.addEventListener("message", (event) => {
      const packet = String(event.data);
      if (packet.startsWith("0"))
        socket.send("40" + JSON.stringify({ token: `Bearer ${token}` }));
      if (packet === "2") socket.send("3");
      if (packet.startsWith("40")) {
        clearTimeout(timeout);
        resolve();
      }
      if (packet.startsWith("42")) events.push(JSON.parse(packet.slice(2)));
      if (packet.startsWith("44")) {
        clearTimeout(timeout);
        reject(new Error("WebSocket authentication failed"));
      }
    });
  });
  return events;
}

async function waitForEvent(
  events: Array<[string, Record<string, unknown>]>,
  name: string,
) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const event = events.find(([eventName]) => eventName === name);
    if (event) return event[1];
    await delay(10);
  }
  throw new Error(`Missing realtime event: ${name}`);
}

try {
  await app.register(fastifyCookie, { secret: process.env.COOKIE_SECRET });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(0, "127.0.0.1");
  const url = await app.getUrl();
  const prisma = app.get(PrismaService);
  const repository = app.get(MessagingRepository);
  const password = "MessagingTest123!";
  const passwordHash = await argon2.hash(password);
  const runId = randomUUID().slice(0, 8);

  async function createUser(name: string) {
    const user = await prisma.client.orm.public.User.create({
      username: `msg_${runId}_${name}`,
      displayName: name,
      email: `msg_${runId}_${name}@example.test`,
      passwordHash,
      isEmailVerified: true,
    });
    createdUserIds.push(user.id);
    return user;
  }

  async function request<T>(
    path: string,
    token?: string,
    body?: unknown,
    expectedStatus = body ? 201 : 200,
  ): Promise<T> {
    const response = await fetch(`${url}/api/v1${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(10000),
    });
    const result = await response.json();
    assert.equal(
      response.status,
      expectedStatus,
      `${path}: ${JSON.stringify(result)}`,
    );
    return result as T;
  }

  const alice = await createUser("alice");
  const bob = await createUser("bob");
  const outsider = await createUser("outsider");
  async function login(email: string) {
    return (
      await request<{ accessToken: string }>(
        "/auth/login",
        undefined,
        { email, password },
        200,
      )
    ).accessToken;
  }
  const aliceToken = await login(alice.email);
  const bobToken = await login(bob.email);
  const outsiderToken = await login(outsider.email);
  const aliceEvents = await connectSocket(url, aliceToken);
  const bobEvents = await connectSocket(url, bobToken);
  const outsiderEvents = await connectSocket(url, outsiderToken);

  const conversation = await request<ConversationResponseDto>(
    "/conversations/direct",
    aliceToken,
    { targetUserId: bob.id },
  );
  const same = await request<ConversationResponseDto>(
    "/conversations/direct",
    bobToken,
    { targetUserId: alice.id },
  );
  assert.equal(same.id, conversation.id);

  // Keep the original conversation outside the first page and test equal-timestamp cursors.
  for (let i = 0; i < 32; i++) {
    const peer = await createUser(`peer${i}`);
    const item = await repository.createDirectConversation(
      [alice.id, peer.id].sort().join(":"),
      [alice.id, peer.id],
    );
    assert.ok(item);
    await repository.conversation
      .where({ id: item.id })
      .update({ updatedAt: Temporal.Instant.from("2099-01-01T00:00:00Z") });
  }
  const firstPage = await request<ConversationPageDto>(
    "/conversations?limit=30",
    aliceToken,
  );
  assert.equal(firstPage.data.length, 30);
  assert.equal(firstPage.hasMore, true);
  assert.ok(firstPage.nextCursor);
  assert.ok(!firstPage.data.some((item) => item.id === conversation.id));
  const secondPage = await request<ConversationPageDto>(
    `/conversations?limit=30&cursor=${encodeURIComponent(firstPage.nextCursor)}`,
    aliceToken,
  );
  assert.equal(secondPage.hasMore, false);
  assert.equal(secondPage.data.length, 3);
  assert.equal(
    new Set([...firstPage.data, ...secondPage.data].map((item) => item.id))
      .size,
    33,
  );
  const detail = await request<ConversationResponseDto>(
    `/conversations/${conversation.id}`,
    aliceToken,
  );
  assert.equal(detail.participant.id, bob.id);
  await request(
    `/conversations/${conversation.id}`,
    outsiderToken,
    undefined,
    404,
  );
  await request(
    `/conversations/${conversation.id}/messages`,
    outsiderToken,
    undefined,
    403,
  );
  await request(
    `/conversations/${conversation.id}/messages`,
    outsiderToken,
    { body: "forbidden", clientMessageId: randomUUID() },
    403,
  );

  const payload = { body: "Xin chào Bob", clientMessageId: randomUUID() };
  const message = await request<MessageResponseDto>(
    `/conversations/${conversation.id}/messages`,
    aliceToken,
    payload,
  );
  const retried = await request<MessageResponseDto>(
    `/conversations/${conversation.id}/messages`,
    aliceToken,
    payload,
  );
  assert.equal(message.id, retried.id);
  assert.equal(
    (await waitForEvent(aliceEvents, "conversation:new-message"))
      .conversationId,
    conversation.id,
  );
  assert.equal(
    (await waitForEvent(bobEvents, "conversation:new-message")).conversationId,
    conversation.id,
  );
  assert.equal(
    (await request<{ count: number }>("/conversations/unread-count", bobToken))
      .count,
    1,
  );
  await request(`/conversations/${conversation.id}/read`, bobToken, {});
  await waitForEvent(bobEvents, "conversation:read");
  assert.equal(
    (await request<{ count: number }>("/conversations/unread-count", bobToken))
      .count,
    0,
  );
  assert.equal(
    bobEvents.filter(([name]) => name === "conversation:new-message").length,
    1,
  );
  assert.equal(outsiderEvents.length, 0);

  await request(`/conversations/${conversation.id}/messages`, bobToken, {
    body: "Chào Alice",
    clientMessageId: randomUUID(),
  });
  assert.equal(
    (
      await request<{ count: number }>(
        "/conversations/unread-count",
        aliceToken,
      )
    ).count,
    1,
  );
  for (let i = 0; i < 32; i++) {
    await repository.createMessage({
      conversationId: conversation.id,
      senderId: alice.id,
      clientMessageId: randomUUID(),
      body: `History ${i}`,
    });
  }
  const recent = await request<MessagePageDto>(
    `/conversations/${conversation.id}/messages?limit=30`,
    aliceToken,
  );
  assert.equal(recent.data.length, 30);
  assert.ok(recent.nextCursor);
  const older = await request<MessagePageDto>(
    `/conversations/${conversation.id}/messages?limit=30&cursor=${encodeURIComponent(recent.nextCursor)}`,
    aliceToken,
  );
  assert.equal(older.data.length, 4);
  assert.equal(older.hasMore, false);
  assert.equal(
    new Set([...recent.data, ...older.data].map((item) => item.id)).size,
    34,
  );
  console.log(
    "PASS: login, 33 conversations across pages, old deep link, access control, two-way messaging, retry deduplication, realtime isolation, read/unread, 34 paginated messages.",
  );
} finally {
  for (const socket of sockets) socket.close();
  const prisma = app.get(PrismaService);
  try {
    for (const userId of createdUserIds)
      await prisma.client.orm.public.User.where({ id: userId }).delete();
  } finally {
    await app.close();
  }
}
