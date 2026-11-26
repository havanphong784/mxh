import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mock } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import fastifyCookie from "@fastify/cookie";
import { Temporal } from "@js-temporal/polyfill";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import argon2 from "argon2";
import type {
  ConversationPageDto,
  ConversationResponseDto,
  MessagePageDto,
  MessageResponseDto,
} from "./dto/messaging-response.dto.js";

// This opt-in check creates and cleans up its own fixtures in a migrated local test DB.
const databaseUrl = process.env.MESSAGING_TEST_DATABASE_URL;
if (!databaseUrl || process.env.NODE_ENV === "production") {
  throw new Error("Đặt MESSAGING_TEST_DATABASE_URL trỏ tới database thử nghiệm đã chạy migration.");
}
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname)) {
  throw new Error("Kiểm thử messaging chỉ chạy với database cục bộ.");
}
process.env.DATABASE_URL = databaseUrl;
process.env.NODE_ENV = "test";
process.env.JWT_ACCESS_SECRET = randomUUID() + randomUUID();
process.env.JWT_REFRESH_SECRET = randomUUID() + randomUUID();
process.env.COOKIE_SECRET = randomUUID() + randomUUID();
process.env.CLOUDINARY_API_SECRET = "integration-test-only-secret";
process.env.CLOUDINARY_CLOUD_NAME = "integration-test";
globalThis.Temporal = Temporal;

const { AppModule } = await import("../app.module.js");
const { PrismaService } = await import("../prisma/prisma.service.js");
const { MessagingRepository } = await import("./messaging.repository.js");
const { MediaService } = await import("../media/media.service.js");
const { AllExceptionsFilter } = await import("../common/filters/all-exceptions.filter.js");
const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
  logger: false,
});
const createdUserIds: string[] = [];
const sockets: WebSocket[] = [];
const reservedMedia: string[] = [];

async function connectSocket(url: string, token: string) {
  const socket = new WebSocket(
    url.replace("http://", "ws://") + "/socket.io/?EIO=4&transport=websocket",
  );
  sockets.push(socket);
  const events: Array<[string, Record<string, unknown>]> = [];
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WebSocket connection timed out")), 5000);
    socket.addEventListener("error", () => {
      clearTimeout(timeout);
      reject(new Error("WebSocket connection failed"));
    });
    socket.addEventListener("message", (event) => {
      const packet = String(event.data);
      if (packet.startsWith("0")) socket.send("40" + JSON.stringify({ token: `Bearer ${token}` }));
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
  return { events, socket };
}

async function waitForEvent(events: Array<[string, Record<string, unknown>]>, name: string) {
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
    assert.equal(response.status, expectedStatus, `${path}: ${JSON.stringify(result)}`);
    return result as T;
  }

  const alice = await createUser("alice");
  const bob = await createUser("bob");
  const outsider = await createUser("outsider");
  async function login(email: string) {
    return (
      await request<{ accessToken: string }>("/auth/login", undefined, { email, password }, 200)
    ).accessToken;
  }
  const aliceToken = await login(alice.email);
  const bobToken = await login(bob.email);
  const outsiderToken = await login(outsider.email);
  const { events: aliceEvents, socket: aliceSocket } = await connectSocket(url, aliceToken);
  const { events: bobEvents } = await connectSocket(url, bobToken);
  const { events: outsiderEvents, socket: outsiderSocket } = await connectSocket(
    url,
    outsiderToken,
  );

  const conversation = await request<ConversationResponseDto>("/conversations/direct", aliceToken, {
    targetUserId: bob.id,
  });
  const same = await request<ConversationResponseDto>("/conversations/direct", bobToken, {
    targetUserId: alice.id,
  });
  assert.equal(same.id, conversation.id);

  // Keep the original conversation outside the first page and test equal-timestamp cursors.
  for (let i = 0; i < 32; i++) {
    const peer = await createUser(`peer${i}`);
    const item = await repository.createDirectConversation([alice.id, peer.id].sort().join(":"), [
      alice.id,
      peer.id,
    ]);
    assert.ok(item);
    await repository.conversation
      .where({ id: item.id })
      .update({ updatedAt: Temporal.Instant.from("2099-01-01T00:00:00Z") });
  }
  const firstPage = await request<ConversationPageDto>("/conversations?limit=30", aliceToken);
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
  assert.equal(new Set([...firstPage.data, ...secondPage.data].map((item) => item.id)).size, 33);
  const detail = await request<ConversationResponseDto>(
    `/conversations/${conversation.id}`,
    aliceToken,
  );
  assert.equal(detail.participant.id, bob.id);
  aliceSocket.send(
    "42" +
      JSON.stringify(["conversation:typing", { conversationId: conversation.id, isTyping: true }]),
  );
  const typing = await waitForEvent(bobEvents, "conversation:typing");
  assert.equal(typing.userId, alice.id);
  assert.equal(typing.conversationId, conversation.id);
  assert.equal(typing.isTyping, true);
  assert.equal(typeof typing.streamId, "string");
  outsiderSocket.send(
    "42" +
      JSON.stringify(["conversation:typing", { conversationId: conversation.id, isTyping: true }]),
  );
  aliceSocket.send(
    "42" +
      JSON.stringify(["conversation:typing", { conversationId: conversation.id, isTyping: false }]),
  );
  const typingDeadline = Date.now() + 5000;
  while (
    bobEvents.filter(([name]) => name === "conversation:typing").length < 2 &&
    Date.now() < typingDeadline
  )
    await delay(10);
  assert.equal(bobEvents.filter(([name]) => name === "conversation:typing").length, 2);
  assert.equal(aliceEvents.filter(([name]) => name === "conversation:typing").length, 0);
  assert.equal(
    (await request<{ count: number }>("/conversations/unread-count", bobToken)).count,
    0,
  );
  assert.equal(outsiderEvents.length, 0);
  await request(`/conversations/${conversation.id}`, outsiderToken, undefined, 404);
  await request(`/conversations/${conversation.id}/messages`, outsiderToken, undefined, 403);
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
    (await waitForEvent(aliceEvents, "conversation:new-message")).conversationId,
    conversation.id,
  );
  assert.equal(
    (await waitForEvent(bobEvents, "conversation:new-message")).conversationId,
    conversation.id,
  );
  assert.equal(
    (await request<{ count: number }>("/conversations/unread-count", bobToken)).count,
    1,
  );
  await request(`/conversations/${conversation.id}/read`, bobToken, {});
  await waitForEvent(bobEvents, "conversation:read");
  assert.equal(
    (await request<{ count: number }>("/conversations/unread-count", bobToken)).count,
    0,
  );
  assert.equal(bobEvents.filter(([name]) => name === "conversation:new-message").length, 1);
  assert.equal(outsiderEvents.length, 0);

  await request(`/conversations/${conversation.id}/messages`, bobToken, {
    body: "Chào Alice",
    clientMessageId: randomUUID(),
  });
  assert.equal(
    (await request<{ count: number }>("/conversations/unread-count", aliceToken)).count,
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
  assert.equal(new Set([...recent.data, ...older.data].map((item) => item.id)).size, 34);

  mock.method(app.get(MediaService), "getImageMetadata", async (publicId: string) => ({
    public_id: publicId,
    version: 1,
    resource_type: "image",
    type: "upload",
    format: "png",
    bytes: 100,
    width: 640,
    height: 480,
  }));
  function imageInput(name: string) {
    const publicId = `mxh/${alice.id}/messages/${runId}-${name}`;
    return {
      publicId,
      version: 1,
      signature: createHash("sha1")
        .update(`public_id=${publicId}&version=1integration-test-only-secret`)
        .digest("hex"),
    };
  }
  const imageRequest = {
    clientMessageId: randomUUID(),
    media: Array.from({ length: 5 }, (_, index) => imageInput(String(index))),
  };
  const image = await request<MessageResponseDto>(
    `/conversations/${conversation.id}/messages`,
    aliceToken,
    imageRequest,
  );
  const retryImage = await request<MessageResponseDto>(
    `/conversations/${conversation.id}/messages`,
    aliceToken,
    imageRequest,
  );
  assert.equal(image.type, "IMAGE");
  assert.equal(image.body, "");
  assert.deepEqual(
    image.media.map((item) => item.order),
    [0, 1, 2, 3, 4],
  );
  assert.deepEqual(image, retryImage);
  assert.equal(await repository.reserveMediaDeletion(image.media[0].publicId), false);
  const imageHistory = await request<MessagePageDto>(
    `/conversations/${conversation.id}/messages`,
    bobToken,
  );
  assert.deepEqual(imageHistory.data.at(-1)?.media, image.media);
  const imageDetail = await request<ConversationResponseDto>(
    `/conversations/${conversation.id}`,
    aliceToken,
  );
  assert.deepEqual(imageDetail.lastMessage?.media, image.media);

  const race = imageInput("race");
  reservedMedia.push(race.publicId);
  const [reserved, raceResponse] = await Promise.all([
    repository.reserveMediaDeletion(race.publicId),
    fetch(`${url}/api/v1/conversations/${conversation.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aliceToken}` },
      body: JSON.stringify({ clientMessageId: randomUUID(), media: [race] }),
    }),
  ]);
  const raceBody = await raceResponse.json();
  if (reserved) assert.ok(raceResponse.status >= 400, JSON.stringify(raceBody));
  else {
    assert.equal(raceResponse.status, 201, JSON.stringify(raceBody));
    assert.equal(await repository.reserveMediaDeletion(race.publicId), false);
  }
  console.log(
    "PASS: REST/socket authorization, typing isolation and unread neutrality, pagination, image persistence/order/history/preview/retry, and cleanup/send concurrency (Cloudinary metadata mocked).",
  );
} finally {
  for (const socket of sockets) socket.close();
  const prisma = app.get(PrismaService);
  try {
    for (const publicId of reservedMedia)
      await prisma.client.orm.public.MessageMediaDeletion.where({ publicId }).delete();
    mock.restoreAll();
    for (const userId of createdUserIds)
      await prisma.client.orm.public.User.where({ id: userId }).delete();
  } finally {
    await app.close();
  }
}
