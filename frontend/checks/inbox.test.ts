import assert from "node:assert/strict";
import test from "node:test";
import {
  inboxRoute,
  pagePath,
  readWindow,
  mergeById,
  messageDraft,
  realtimeImpact,
} from "../src/inbox/model.ts";

test("profile links enter compose and encoded thread identifiers round-trip", () => {
  assert.deepEqual(inboxRoute("/messages?to=person%2B1"), {
    kind: "compose",
    to: "person+1",
  });
  assert.deepEqual(inboxRoute("/messages?new=1"), {
    kind: "compose",
    to: null,
  });
  assert.deepEqual(inboxRoute("/messages/convo%2F1"), {
    kind: "thread",
    id: "convo/1",
  });
  assert.deepEqual(inboxRoute("/notifications"), { kind: "notifications" });
  assert.deepEqual(inboxRoute("/messages/%ZZ"), { kind: "messages" });
});

test("cursor and Vietnamese search terms are encoded as opaque query values", () => {
  const url = new URL(
    pagePath("/users/search", "a+/=", "Đỗ & An"),
    "https://example.test",
  );
  assert.equal(url.searchParams.get("q"), "Đỗ & An");
  assert.equal(url.searchParams.get("cursor"), "a+/=");
});

test("refresh replays the loaded depth from the new head and keeps its new tail cursor", async () => {
  const read = async (cursor: string | null) => {
    if (cursor === null)
      return { items: [{ id: "new" }, { id: "a" }], cursor: "fresh" };
    assert.equal(cursor, "fresh");
    return { items: [{ id: "a" }, { id: "b" }], cursor: "next" };
  };
  assert.deepEqual(await readWindow(read, 2), {
    items: [{ id: "new" }, { id: "a" }, { id: "b" }],
    cursor: "next",
    depth: 2,
  });
});

test("history is prepended without duplicating an overlapping message", () => {
  const old = { id: "m2", body: "old snapshot" };
  const newer = { id: "m2", body: "live snapshot" };
  assert.deepEqual(
    mergeById(
      [{ id: "m1", body: "first" }, old],
      [newer, { id: "m3", body: "last" }],
    ),
    [{ id: "m1", body: "first" }, newer, { id: "m3", body: "last" }],
  );
});

test("message retries reuse the backend client ID only for the same normalized draft", () => {
  const makeId = () => "new-id";
  const prev = { body: "xin chào", clientMessageId: "first-id" };
  assert.deepEqual(messageDraft(" xin chào\n", prev, makeId), prev);
  assert.deepEqual(messageDraft("mới", prev, makeId), {
    body: "mới",
    clientMessageId: "new-id",
  });
  assert.equal(messageDraft("  ", prev, makeId), null);
  assert.equal(messageDraft("a".repeat(2001), null, makeId), null);
});

test("reconnect refreshes both inboxes and only matching new messages refresh the open thread", () => {
  assert.deepEqual(realtimeImpact("connect", null, "c1"), {
    counts: true,
    messages: true,
    thread: true,
    notifications: true,
  });
  assert.deepEqual(
    realtimeImpact("conversation:new-message", { conversationId: "c2" }, "c1"),
    {
      counts: true,
      messages: true,
      thread: false,
      notifications: false,
    },
  );
  assert.deepEqual(
    realtimeImpact("conversation:new-message", { conversationId: "c1" }, "c1"),
    {
      counts: true,
      messages: true,
      thread: true,
      notifications: false,
    },
  );
  assert.deepEqual(
    realtimeImpact("conversation:read", { conversationId: "c1" }, "c1"),
    {
      counts: true,
      messages: true,
      thread: false,
      notifications: false,
    },
  );
  assert.deepEqual(
    realtimeImpact("notification:unread-count", { count: 3 }, "c1"),
    {
      counts: true,
      messages: false,
      thread: false,
      notifications: true,
    },
  );
  assert.equal(realtimeImpact("unrelated", null, "c1"), null);
});
