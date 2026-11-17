import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { reconcileMessagingAfterReconnect } from "./messaging-reconnect.ts";

test("reconnect invalidates conversation data and refreshes unread count", async () => {
  const queryClient = new QueryClient();
  const keys = [
    ["conversations"],
    ["conversations", "conversation-1", "detail"],
    ["conversations", "conversation-1", "messages"],
  ];
  for (const queryKey of keys) queryClient.setQueryData(queryKey, {});
  const unreadCounts: number[] = [];

  await reconcileMessagingAfterReconnect({
    queryClient,
    getUnreadCount: async () => 2,
    setUnreadCount: (count) => unreadCounts.push(count),
    isCurrent: () => true,
  });

  for (const queryKey of keys) {
    assert.equal(queryClient.getQueryState(queryKey)?.isInvalidated, true);
  }
  assert.deepEqual(unreadCounts, [2]);
  queryClient.clear();
});

test("reconnect ignores an unread-count response superseded by a socket event", async () => {
  const queryClient = new QueryClient();
  let eventRevision = 0;
  let resolveUnreadCount!: (count: number) => void;
  const unreadCountRequest = new Promise<number>((resolve) => {
    resolveUnreadCount = resolve;
  });
  const unreadCounts: number[] = [];

  const reconciliation = reconcileMessagingAfterReconnect({
    queryClient,
    getUnreadCount: () => unreadCountRequest,
    setUnreadCount: (count) => unreadCounts.push(count),
    isCurrent: () => eventRevision === 0,
  });

  eventRevision += 1;
  resolveUnreadCount(0);
  await reconciliation;

  assert.deepEqual(unreadCounts, []);
  queryClient.clear();
});

test("reconnect does not update data after the authenticated session changes", async () => {
  const queryClient = new QueryClient();
  let current = true;
  let resolveUnreadCount!: (count: number) => void;
  const unreadCounts: number[] = [];

  const reconciliation = reconcileMessagingAfterReconnect({
    queryClient,
    getUnreadCount: () =>
      new Promise<number>((resolve) => {
        resolveUnreadCount = resolve;
      }),
    setUnreadCount: (count) => unreadCounts.push(count),
    isCurrent: () => current,
  });
  await Promise.resolve();
  current = false;
  resolveUnreadCount(5);
  await reconciliation;

  assert.deepEqual(unreadCounts, []);
  queryClient.clear();
});
