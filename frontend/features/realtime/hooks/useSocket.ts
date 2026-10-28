"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { initSocket, disconnectSocket } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import type { CursorDataPage, NotificationItem } from "@/types/api";
import type { InfiniteData } from "@tanstack/react-query";
import { notificationsApi } from "@/features/notifications/api";

export function useSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const showNewFeedPosts = useNotificationStore((s) => s.showNewFeedPosts);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      disconnectSocket();
      return;
    }

    const socket = initSocket(accessToken);
    notificationsApi
      .unreadCount()
      .then((response) => {
        if (useAuthStore.getState().accessToken === accessToken)
          setUnreadCount(response.data.count);
      })
      .catch(() => undefined);

    // 1. Cập nhật số lượng thông báo chưa đọc
    socket.on("notification:unread-count", (data: { count: number }) => {
      if (useAuthStore.getState().accessToken === accessToken)
        setUnreadCount(data.count);
    });

    // 2. Nhận thông báo mới: chèn vào đầu cache danh sách thông báo
    socket.on("notification:new", (notif: NotificationItem) => {
      if (useAuthStore.getState().accessToken !== accessToken) return;
      queryClient.setQueryData<InfiniteData<CursorDataPage<NotificationItem>>>(
        ["notifications"],
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page, idx) => {
              if (idx === 0) {
                return { ...page, data: [notif, ...page.data] };
              }
              return page;
            }),
          };
        },
      );
    });

    // 3. Có bài viết mới trên feed: bật cờ hiển thị banner (không tự chèn làm giật giao diện)
    socket.on("feed:new-post", () => {
      if (useAuthStore.getState().accessToken === accessToken)
        showNewFeedPosts();
    });

    return () => {
      disconnectSocket();
    };
  }, [
    isAuthenticated,
    accessToken,
    setUnreadCount,
    showNewFeedPosts,
    queryClient,
  ]);
}
