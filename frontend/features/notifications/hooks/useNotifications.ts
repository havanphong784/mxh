'use client';

import { useEffect } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../api';
import { useNotificationStore } from '@/stores/notificationStore';

export function useNotifications(enabled: boolean) {
  const queryClient = useQueryClient();
  const setUnreadCount = useNotificationStore((state) => state.setUnreadCount);
  const list = useInfiniteQuery({ queryKey: ['notifications'], queryFn: async ({ pageParam }) => (await notificationsApi.list(pageParam)).data, initialPageParam: null as string | null, getNextPageParam: (page) => page.hasMore ? page.nextCursor ?? undefined : undefined, enabled });
  const unread = useQuery({ queryKey: ['notifications', 'unread'], queryFn: async () => (await notificationsApi.unreadCount()).data, enabled });
  useEffect(() => { if (unread.data) setUnreadCount(unread.data.count); }, [unread.data, setUnreadCount]);
  const markRead = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notifications'] }); } });
  const markAll = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: () => { setUnreadCount(0); queryClient.invalidateQueries({ queryKey: ['notifications'] }); } });
  return { ...list, markRead: markRead.mutate, markAll: markAll.mutate, isMarkingAll: markAll.isPending };
}
