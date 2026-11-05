import assert from "node:assert/strict";
import test from "node:test";
import type { InfiniteData } from "@tanstack/react-query";
import type { CursorDataPage, NotificationItem } from "../../types/api.ts";
import { upsertNotification } from "./cache.ts";

test("a reactivated notification appears once at the top of the list", () => {
  const old = {
    id: "like-1",
    isRead: true,
    createdAt: "old",
  } as NotificationItem;
  const other = {
    id: "other",
    isRead: false,
    createdAt: "other",
  } as NotificationItem;
  const newer = { ...old, isRead: false, createdAt: "new" };
  const cached = {
    pages: [
      { data: [other], nextCursor: "page-2", hasMore: true },
      { data: [old], nextCursor: null, hasMore: false },
    ],
    pageParams: [null, "page-2"],
  } as InfiniteData<CursorDataPage<NotificationItem>>;

  const result = upsertNotification(cached, newer);
  assert.ok(result);

  assert.deepEqual(
    result.pages.flatMap((page) => page.data.map((item) => item.id)),
    ["like-1", "other"],
  );
  assert.equal(result.pages[0].data[0].isRead, false);
  assert.equal(result.pages[0].data[0].createdAt, "new");
  assert.deepEqual(result.pageParams, cached.pageParams);
});
