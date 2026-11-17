import type { AxiosResponse } from "axios";
import { apiClient } from "@/lib/axios";
import type {
  ConversationItem,
  MessageItem,
  MessagingPage,
  UnreadCountResponse,
} from "@/types/api";

export const messagingApi = {
  listConversations: (
    cursor?: string | null,
  ): Promise<AxiosResponse<MessagingPage<ConversationItem>>> =>
    apiClient.get<MessagingPage<ConversationItem>>("/conversations", {
      params: { cursor, limit: 30 },
    }),

  unreadCount: (): Promise<AxiosResponse<UnreadCountResponse>> =>
    apiClient.get<UnreadCountResponse>("/conversations/unread-count"),

  getConversation: (
    conversationId: string,
  ): Promise<AxiosResponse<ConversationItem>> =>
    apiClient.get<ConversationItem>(`/conversations/${conversationId}`),

  getOrCreateDirect: (
    targetUserId: string,
  ): Promise<AxiosResponse<ConversationItem>> =>
    apiClient.post<ConversationItem>("/conversations/direct", { targetUserId }),

  listMessages: (
    conversationId: string,
    cursor?: string | null,
  ): Promise<AxiosResponse<MessagingPage<MessageItem>>> =>
    apiClient.get<MessagingPage<MessageItem>>(
      `/conversations/${conversationId}/messages`,
      { params: { cursor, limit: 30 } },
    ),

  sendMessage: (
    conversationId: string,
    data: { body: string; clientMessageId: string },
  ): Promise<AxiosResponse<MessageItem>> =>
    apiClient.post<MessageItem>(
      `/conversations/${conversationId}/messages`,
      data,
    ),

  markRead: (conversationId: string) =>
    apiClient.post(`/conversations/${conversationId}/read`),
};
