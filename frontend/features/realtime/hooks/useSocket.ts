'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { initSocket, disconnectSocket } from '@/lib/socket';
import { useQueryClient } from '@tanstack/react-query';
import type { NotificationItem } from '@/types/api';

export function useSocket() {
  const { accessToken, isAuthenticated } = useAuthStore();
  const { setUnreadCount } = useNotificationStore();
  const queryClient = useQueryClient();
  const [hasNewFeedPosts, setHasNewFeedPosts] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      disconnectSocket();
      return;
    }

    const socket = initSocket(accessToken);

    // 1. Cập nhật số lượng thông báo chưa đọc
    socket.on('notification:unread-count', (data: { count: number }) => {
      setUnreadCount(data.count);
    });

    // 2. Nhận thông báo mới: chèn vào đầu cache danh sách thông báo
    socket.on('notification:new', (notif: NotificationItem) => {
      queryClient.setQueryData(['notifications'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any, idx: number) => {
            if (idx === 0) {
              return { ...page, data: [notif, ...page.data] };
            }
            return page;
          }),
        };
      });
    });

    // 3. Có bài viết mới trên feed: bật cờ hiển thị banner (không tự chèn làm giật giao diện)
    socket.on('feed:new-post', () => {
      setHasNewFeedPosts(true);
    });

    return () => {
      disconnectSocket();
    };
  }, [isAuthenticated, accessToken, setUnreadCount, queryClient]);

  const clearNewFeedNotice = () => setHasNewFeedPosts(false);

  return { hasNewFeedPosts, clearNewFeedNotice };
}
