import assert from "node:assert/strict";
import { test } from "node:test";
import { queryClient } from "./query-client.ts";
import { useAuthStore } from "../stores/authStore.ts";
import { useNotificationStore } from "../stores/notificationStore.ts";

const user = (id: string) => ({
  id,
  username: id,
  displayName: id,
  avatarUrl: null,
});

test("signing out removes private cached data and notification state", () => {
  useAuthStore.getState().setAuth(user("alice"), "token-a");
  queryClient.setQueryData(["posts", "feed"], { owner: "alice" });
  queryClient.setQueryData(["notifications"], { owner: "alice" });
  useNotificationStore.getState().setUnreadCount(4);
  useNotificationStore.getState().showNewFeedPosts();

  useAuthStore.getState().clearAuth();

  assert.equal(queryClient.getQueryData(["posts", "feed"]), undefined);
  assert.equal(queryClient.getQueryData(["notifications"]), undefined);
  assert.equal(useNotificationStore.getState().unreadCount, 0);
  assert.equal(useNotificationStore.getState().hasNewFeedPosts, false);
});

test("switching accounts removes the previous account cache but refreshing the same account retains it", () => {
  useAuthStore.getState().setAuth(user("alice"), "token-a");
  const aliceVersion = useAuthStore.getState().sessionVersion;
  queryClient.setQueryData(["posts", "feed"], { owner: "alice" });

  useAuthStore.getState().setAuth(user("alice"), "token-b");
  assert.deepEqual(queryClient.getQueryData(["posts", "feed"]), {
    owner: "alice",
  });
  assert.equal(useAuthStore.getState().sessionVersion, aliceVersion);

  useAuthStore.getState().setAuth(user("bob"), "token-c");
  assert.equal(queryClient.getQueryData(["posts", "feed"]), undefined);
  assert.equal(useAuthStore.getState().sessionVersion, aliceVersion + 1);

  useAuthStore.getState().clearAuth();
  assert.equal(useAuthStore.getState().sessionVersion, aliceVersion + 2);
});
