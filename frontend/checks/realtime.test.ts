import assert from "node:assert/strict";
import test from "node:test";

const recoveryModule = () => import("../src/realtime.ts");

test("typing bridge only emits volatile events on its current connected socket", async () => {
  const { bindTypingSocket, emitTyping } = await recoveryModule();
  const sent: unknown[] = [];
  const socket = {
    connected: false,
    volatile: {
      emit: (event: string, data: unknown) => {
        sent.push([event, data]);
      },
    },
  };
  const unbind = bindTypingSocket(socket);
  emitTyping("thread", true);
  assert.deepEqual(sent, []);
  socket.connected = true;
  assert.deepEqual(sent, []);
  emitTyping("thread", true);
  assert.deepEqual(sent, [["conversation:typing", { conversationId: "thread", isTyping: true }]]);
  socket.connected = false;
  emitTyping("thread", false);
  socket.connected = true;
  assert.equal(sent.length, 1);
  const other: unknown[] = [];
  const cleanup = bindTypingSocket({
    connected: true,
    volatile: {
      emit: (_event: string, data: unknown) => {
        other.push(data);
      },
    },
  });
  unbind();
  emitTyping("thread", false);
  assert.deepEqual(other, [{ conversationId: "thread", isTyping: false }]);
  cleanup();
  emitTyping("thread", true);
  assert.equal(other.length, 1);
});

test("an offline refresh retries and reconnects after connectivity returns", async () => {
  const { createSocketRecovery } = await recoveryModule();
  let attempts = 0;
  let connections = 0;
  const callbacks: (() => void)[] = [];
  const delays: number[] = [];
  const socket = {
    active: false,
    connected: false,
    connect() {
      connections++;
    },
  };
  const recovery = createSocketRecovery(
    socket,
    async () => {
      if (++attempts === 1) throw new TypeError("offline");
      return "fresh";
    },
    (callback, delay) => {
      callbacks.push(callback);
      delays.push(delay);
      return () => {};
    },
  );
  await recovery.recover();
  assert.equal(connections, 0);
  assert.equal(callbacks.length, 1);
  assert.equal(delays[0], 1000);
  callbacks.shift()!();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(attempts, 2);
  assert.equal(connections, 1);
  recovery.dispose();
});

test("revoked sessions do not retry or reconnect", async () => {
  const { createSocketRecovery } = await recoveryModule();
  const socket = {
    active: false,
    connected: false,
    connect: () => assert.fail("revoked session connected"),
  };
  const recovery = createSocketRecovery(
    socket,
    async () => null,
    () => assert.fail("revoked session scheduled"),
  );
  await recovery.recover();
  recovery.dispose();
});

test("duplicate recovery events share one pending refresh", async () => {
  const { createSocketRecovery } = await recoveryModule();
  let finish: (token: string) => void = () => {};
  let attempts = 0;
  let connections = 0;
  const recovery = createSocketRecovery(
    {
      active: false,
      connected: false,
      connect() {
        connections++;
      },
    },
    () => {
      attempts++;
      return new Promise<string>((resolve) => {
        finish = resolve;
      });
    },
  );
  const pending = recovery.recover();
  await recovery.recover();
  assert.equal(attempts, 1);
  finish("fresh");
  await pending;
  assert.equal(connections, 1);
  recovery.dispose();
});

test("unmount cancels pending reconnect without reviving the socket", async () => {
  const { createSocketRecovery } = await recoveryModule();
  let finish: (token: string) => void = () => {};
  const recovery = createSocketRecovery(
    {
      active: false,
      connected: false,
      connect: () => assert.fail("unmounted socket reconnected"),
    },
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  const pending = recovery.recover();
  recovery.dispose();
  finish("fresh");
  await pending;
});
