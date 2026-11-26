import assert from "node:assert/strict";
import { test } from "node:test";
import { createTypingController } from "../src/inbox/typing.ts";

function fixture() {
  let time = 0;
  let serial = 0;
  const timers = new Map<number, { at: number; run: () => void }>();
  const emitted: [string, boolean][] = [];
  const changes: boolean[] = [];
  const controller = createTypingController({
    conversationId: "thread",
    userId: "alice",
    peerId: "bob",
    emit: (id: string, typing: boolean) => {
      emitted.push([id, typing]);
    },
    now: () => time,
    schedule: (run: () => void, delay: number) => {
      const id = ++serial;
      timers.set(id, { at: time + delay, run });
      return () => {
        timers.delete(id);
      };
    },
    onChange: (value: boolean) => {
      changes.push(value);
    },
  });
  function advance(ms: number) {
    const end = time + ms;
    while (true) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      time = next[1].at;
      timers.delete(next[0]);
      next[1].run();
    }
    time = end;
  }
  return { controller, emitted, changes, advance, timers };
}
const payload = { conversationId: "thread", userId: "bob", streamId: "tab-1", isTyping: true };

test("typing only starts from input changes and throttles heartbeats to 2000ms", () => {
  const f = fixture();
  assert.deepEqual(f.emitted, []);
  f.controller.changed("hello");
  f.advance(1999);
  f.controller.changed("hello there");
  assert.deepEqual(f.emitted, [["thread", true]]);
  f.advance(1);
  f.controller.changed("hello again");
  assert.deepEqual(f.emitted, [
    ["thread", true],
    ["thread", true],
  ]);
  f.advance(10000);
  assert.equal(f.emitted.length, 2);
  f.controller.changed("");
  assert.deepEqual(f.emitted.at(-1), ["thread", false]);
  f.controller.changed("new");
  f.controller.stop();
  assert.deepEqual(f.emitted.slice(-2), [
    ["thread", true],
    ["thread", false],
  ]);
});

test("receiver expires at 4000ms and heartbeat renews expiry", () => {
  const f = fixture();
  f.controller.receive(payload);
  f.advance(3999);
  assert.deepEqual(f.changes, [true]);
  f.controller.receive(payload);
  f.advance(3999);
  assert.deepEqual(f.changes, [true]);
  f.advance(1);
  assert.deepEqual(f.changes, [true, false]);
  assert.equal(f.timers.size, 0);
});

test("stopping one tab preserves another tab until its own expiry", () => {
  const f = fixture();
  f.controller.receive(payload);
  f.advance(1000);
  f.controller.receive({ ...payload, streamId: "tab-2" });
  f.controller.receive({ ...payload, isTyping: false });
  f.advance(3999);
  assert.deepEqual(f.changes, [true]);
  f.advance(1);
  assert.deepEqual(f.changes, [true, false]);
});

test("receiver ignores self, wrong thread, wrong peer and malformed payloads", () => {
  const f = fixture();
  for (const value of [
    null,
    [],
    {},
    { ...payload, userId: "alice" },
    { ...payload, userId: "eve" },
    { ...payload, conversationId: "other" },
    { ...payload, streamId: "" },
    { ...payload, isTyping: "true" },
  ])
    f.controller.receive(value);
  assert.deepEqual(f.changes, []);
  assert.equal(f.timers.size, 0);
});

test("disconnect clears all streams and lets fresh input start immediately without replay", () => {
  const f = fixture();
  f.controller.changed("hello");
  f.controller.receive(payload);
  f.controller.disconnected();
  assert.deepEqual(f.changes, [true, false]);
  assert.equal(f.timers.size, 0);
  assert.deepEqual(f.emitted, [["thread", true]]);
  f.advance(10000);
  assert.equal(f.emitted.length, 1);
  f.controller.changed("fresh");
  assert.deepEqual(f.emitted.at(-1), ["thread", true]);
});

test("dispose stops outgoing typing and cancels receiver work permanently", () => {
  const f = fixture();
  f.controller.changed("hello");
  f.controller.receive(payload);
  f.controller.dispose();
  assert.deepEqual(f.emitted, [
    ["thread", true],
    ["thread", false],
  ]);
  assert.equal(f.timers.size, 0);
  f.controller.receive(payload);
  f.controller.changed("late");
  f.advance(10000);
  assert.deepEqual(f.changes, [true, false]);
  assert.equal(f.emitted.length, 2);
});
