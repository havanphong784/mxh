import { apiClient } from '@/lib/axios';
import type { CursorDataPage, NotificationItem, UnreadCountResponse } from '@/types/api';

export const notificationsApi = {
  list: (cursor?: string | null) => apiClient.get<CursorDataPage<NotificationItem>>('/notifications', { params: { cursor, limit: 20 } }),
  unreadCount: () => apiClient.get<UnreadCountResponse>('/notifications/unread-count'),
  markRead: (id: string) => apiClient.patch(`/notifications/${id}/read`),
  markAllRead: () => apiClient.post('/notifications/read-all'),
};
