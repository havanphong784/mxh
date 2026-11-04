import type { InfiniteData } from "@tanstack/react-query";
import type { CursorDataPage, NotificationItem } from "../../types/api.ts";

export function upsertNotification(
  cached: InfiniteData<CursorDataPage<NotificationItem>> | undefined,
  notification: NotificationItem,
): InfiniteData<CursorDataPage<NotificationItem>> | undefined {
  if (!cached?.pages.length) return cached;

  return {
    ...cached,
    pages: cached.pages.map((page, index) => ({
      ...page,
      data: [
        ...(index === 0 ? [notification] : []),
        ...page.data.filter((item) => item.id !== notification.id),
      ],
    })),
  };
}
