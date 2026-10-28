import type { AxiosResponse } from "axios";
import { apiClient } from "@/lib/axios";
import type {
  CursorDataPage,
  NotificationItem,
  UnreadCountResponse,
} from "@/types/api";

export const notificationsApi = {
  list: (
    cursor?: string | null,
  ): Promise<AxiosResponse<CursorDataPage<NotificationItem>>> =>
    apiClient.get<CursorDataPage<NotificationItem>>("/notifications", {
      params: { cursor, limit: 20 },
    }),

  unreadCount: (): Promise<AxiosResponse<UnreadCountResponse>> =>
    apiClient.get<UnreadCountResponse>("/notifications/unread-count"),

  markRead: (id: string): Promise<AxiosResponse<void>> =>
    apiClient.patch(`/notifications/${id}/read`),

  markAllRead: (): Promise<AxiosResponse<void>> =>
    apiClient.post("/notifications/read-all"),
};
