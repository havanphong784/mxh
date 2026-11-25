import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { Temporal } from "@js-temporal/polyfill";
import { NotificationsListener } from "./notifications.listener.js";
import { NotificationsRepository } from "./notifications.repository.js";

test("reactivating an existing notification writes a Temporal.Instant", async () => {
  const updates: Record<string, unknown>[] = [];
  const existing = { id: "notification-1", isRead: true };
  const query: any = {
    where() {
      return query;
    },
    async first() {
      return existing;
    },
    async update(payload: Record<string, unknown>) {
      updates.push(payload);
    },
  };
  const prisma = {
    client: { orm: { public: { Notification: { where: () => query } } } },
  };
  const listener = new NotificationsListener(
    new NotificationsRepository(prisma as any),
    {} as any,
    {} as any,
    {} as any,
  );
  (listener as any).sendRealtimeNotification = async () => {};

  await listener.handlePostLiked({
    actorId: "actor",
    postAuthorId: "recipient",
    postId: "post",
  });
  await listener.handlePostReposted({
    actorId: "actor",
    postAuthorId: "recipient",
    postId: "post",
  });
  await listener.handleUserFollowed({
    followerId: "actor",
    followingId: "recipient",
  });

  assert.equal(updates.length, 3);
  for (const update of updates) {
    assert.equal(update.isRead, false);
    assert.ok(update.createdAt instanceof Temporal.Instant);
  }
});
