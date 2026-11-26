import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Socket } from "socket.io";
import type { AccessSessionService } from "../auth/access-session.service.js";
import type { EventsGateway } from "../gateway/events.gateway.js";
import type { MessagingService } from "./messaging.service.js";
import { MessagingTypingGateway } from "./messaging-typing.gateway.js";

function fixture() {
  let time = 0;
  let revoked = false;
  let checks = 0;
  let disconnected = false;
  const relayed: { recipient: string; event: string; data: unknown }[] = [];
  const socket = {
    id: "tab-a",
    connected: true,
    data: { userId: "alice", sessionId: "session-a" },
    handshake: { auth: { token: "Bearer valid" }, headers: {} },
    disconnect() {
      disconnected = true;
      this.connected = false;
    },
  };
  const gateway = new MessagingTypingGateway(
    {
      async getTypingRecipient(userId: string, conversationId: string) {
        assert.equal(userId, "alice");
        if (conversationId === "outside") throw new Error("Forbidden");
        return "bob";
      },
    } as MessagingService,
    {
      pushToUser(recipient: string, event: string, data: unknown) {
        relayed.push({ recipient, event, data });
      },
    } as EventsGateway,
    {
      async verifyAccessToken(token: string) {
        checks++;
        assert.equal(token, "valid");
        if (revoked) throw new Error("revoked");
        return { sub: "alice", sessionId: "session-a" };
      },
    } as AccessSessionService,
  );
  const clock = test.mock.method(Date, "now", () => time);
  return {
    gateway,
    socket: socket as unknown as Socket,
    relayed,
    time(value: number) {
      time = value;
    },
    revoke() {
      revoked = true;
    },
    checks: () => checks,
    disconnected: () => disconnected,
    cleanup: () => clock.mock.restore(),
  };
}

const start = { conversationId: "conversation-1", isTyping: true };
test("typing validates payloads and never trusts supplied identities", async () => {
  const f = fixture();
  try {
    for (const input of [
      null,
      [],
      {},
      { ...start, isTyping: "true" },
      { ...start, conversationId: "" },
      { ...start, userId: "mallory" },
      { ...start, recipientId: "eve" },
    ]) {
      await f.gateway.handleTyping(f.socket, input);
    }
    assert.deepEqual(f.relayed, []);
    await f.gateway.handleTyping(f.socket, start);
    assert.deepEqual(f.relayed, [
      {
        recipient: "bob",
        event: "conversation:typing",
        data: { ...start, userId: "alice", streamId: "tab-a" },
      },
    ]);
  } finally {
    f.cleanup();
  }
});

test("typing rejects unauthenticated, outsider, revoked and mismatched sessions", async () => {
  const f = fixture();
  try {
    f.socket.data.userId = undefined;
    await f.gateway.handleTyping(f.socket, start);
    f.socket.data.userId = "alice";
    await f.gateway.handleTyping(f.socket, { ...start, conversationId: "outside" });
    f.socket.data.sessionId = "wrong-session";
    await f.gateway.handleTyping(f.socket, start);
    assert.deepEqual(f.relayed, []);
    assert.equal(f.disconnected(), true);
  } finally {
    f.cleanup();
  }
  const revoked = fixture();
  try {
    revoked.revoke();
    await revoked.gateway.handleTyping(revoked.socket, start);
    assert.deepEqual(revoked.relayed, []);
    assert.equal(revoked.disconnected(), true);
  } finally {
    revoked.cleanup();
  }
});

test("typing throttles heartbeats at 0/1999/2000ms but immediately relays stop", async () => {
  const f = fixture();
  try {
    await f.gateway.handleTyping(f.socket, start);
    f.time(1999);
    await f.gateway.handleTyping(f.socket, start);
    await f.gateway.handleTyping(f.socket, { ...start, isTyping: false });
    f.time(2000);
    await f.gateway.handleTyping(f.socket, start);
    assert.deepEqual(
      f.relayed.map((entry) => (entry.data as typeof start).isTyping),
      [true, false, true],
    );
  } finally {
    f.cleanup();
  }
});

test("typing bounds spam across conversations and releases limits on disconnect", async () => {
  const f = fixture();
  try {
    for (let i = 0; i < 100; i++)
      await f.gateway.handleTyping(f.socket, {
        conversationId: `conversation-${i}`,
        isTyping: i % 2 === 0,
      });
    assert.equal(f.relayed.length, 30);
    assert.equal(f.checks(), 30);
    f.time(10000);
    await f.gateway.handleTyping(f.socket, start);
    assert.equal(f.relayed.length, 31);
    f.gateway.handleDisconnect(f.socket);
    await f.gateway.handleTyping(f.socket, start);
    assert.equal(f.relayed.length, 32);
  } finally {
    f.cleanup();
  }
});

test("typing reserves heartbeat slots before async authorization finishes", async () => {
  const f = fixture();
  try {
    await Promise.all(Array.from({ length: 10 }, () => f.gateway.handleTyping(f.socket, start)));
    assert.equal(f.relayed.length, 1);
  } finally {
    f.cleanup();
  }
});
