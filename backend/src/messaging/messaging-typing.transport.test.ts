import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { AccessSessionService } from "../auth/access-session.service.js";
import { EventsGateway } from "../gateway/events.gateway.js";
import { MessagingService } from "./messaging.service.js";
import { MessagingTypingGateway } from "./messaging-typing.gateway.js";

// Exercise Nest's actual gateway registration and Socket.IO transport without a DB.
// Only the session and membership data sources are substituted.
test("registered typing gateway uses the authenticated socket and isolates peer events", {
  timeout: 15000,
}, async () => {
  let revoked = false;
  @Module({
    providers: [
      EventsGateway,
      MessagingTypingGateway,
      {
        provide: AccessSessionService,
        useValue: {
          async verifyAccessToken(token: string) {
            if (token === "alice" && revoked) throw new Error("Revoked session");
            if (!["alice", "bob", "outsider"].includes(token)) throw new Error("Invalid session");
            return { sub: token, sessionId: `session-${token}` };
          },
        },
      },
      {
        provide: MessagingService,
        useValue: {
          async getTypingRecipient(userId: string, conversationId: string) {
            if (conversationId !== "thread" || userId === "outsider")
              throw new Error("Not a member");
            return userId === "alice" ? "bob" : "alice";
          },
        },
      },
    ],
  })
  class TestModule {}
  const app = await NestFactory.create(TestModule, new FastifyAdapter(), { logger: false });
  const sockets: WebSocket[] = [];
  async function until(predicate: () => boolean) {
    const deadline = Date.now() + 4000;
    while (!predicate() && Date.now() < deadline) await delay(5);
    assert.equal(predicate(), true, "socket event timed out");
  }
  try {
    await app.listen(0, "127.0.0.1");
    const url = (await app.getUrl()).replace("http:", "ws:");
    async function connect(userId: string) {
      const socket = new WebSocket(`${url}/socket.io/?EIO=4&transport=websocket`);
      sockets.push(socket);
      const events: { event: string; data: Record<string, unknown> }[] = [];
      let ready = false;
      socket.addEventListener("message", (message) => {
        const packet = String(message.data);
        if (packet.startsWith("0")) socket.send("40" + JSON.stringify({ token: userId }));
        if (packet === "2") socket.send("3");
        if (packet.startsWith("40")) ready = true;
        if (packet.startsWith("42")) {
          const [event, data] = JSON.parse(packet.slice(2));
          events.push({ event, data });
        }
      });
      await until(() => ready && app.get(EventsGateway).isUserOnline(userId));
      return {
        socket,
        events,
        emit(data: unknown) {
          socket.send("42" + JSON.stringify(["conversation:typing", data]));
        },
      };
    }
    const alice = await connect("alice");
    const bob = await connect("bob");
    const outsider = await connect("outsider");
    alice.emit({ conversationId: "thread", isTyping: true });
    await until(() => bob.events.length === 1);
    assert.deepEqual(bob.events[0], {
      event: "conversation:typing",
      data: {
        conversationId: "thread",
        userId: "alice",
        streamId: bob.events[0].data.streamId,
        isTyping: true,
      },
    });
    assert.equal(typeof bob.events[0].data.streamId, "string");
    alice.emit({ conversationId: "thread", isTyping: false });
    outsider.emit({ conversationId: "thread", isTyping: true });
    await until(() => bob.events.length === 2);
    assert.equal(bob.events[1].data.isTyping, false);
    revoked = true;
    let closed = false;
    alice.socket.addEventListener("close", () => {
      closed = true;
    });
    alice.emit({ conversationId: "thread", isTyping: false });
    await until(() => closed);
    assert.equal(bob.events.length, 2);
    assert.deepEqual(alice.events, []);
    assert.deepEqual(outsider.events, []);
  } finally {
    sockets.forEach((socket) => {
      socket.close();
    });
    await app.close();
  }
});
