"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import { messagingApi } from "./api";
import type { MessageItem, MessagingPage } from "@/types/api";
import { useAuthStore } from "@/stores/authStore";
import { replaceMessage, upsertMessage } from "./cache";

export function useConversations(enabled = true) {
  return useInfiniteQuery({
    queryKey: ["conversations"],
    queryFn: async ({ pageParam }) =>
      (await messagingApi.listConversations(pageParam)).data,
    initialPageParam: null as string | null,
    getNextPageParam: (page) =>
      page.hasMore ? (page.nextCursor ?? undefined) : undefined,
    enabled,
  });
}

export function useMessages(conversationId: string | null, enabled = true) {
  return useInfiniteQuery({
    queryKey: ["conversations", conversationId, "messages"],
    queryFn: async ({ pageParam }) =>
      (await messagingApi.listMessages(conversationId!, pageParam)).data,
    initialPageParam: null as string | null,
    getNextPageParam: (page) =>
      page.hasMore ? (page.nextCursor ?? undefined) : undefined,
    enabled: Boolean(conversationId) && enabled,
  });
}

export function useConversation(conversationId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["conversations", conversationId, "detail"],
    queryFn: async () =>
      (await messagingApi.getConversation(conversationId!)).data,
    enabled: Boolean(conversationId) && enabled,
  });
}

export function useConversationUnreadCount(enabled = true) {
  return useQuery({
    queryKey: ["conversations", "unread-count"],
    queryFn: async () => (await messagingApi.unreadCount()).data,
    enabled,
  });
}

export function useSendMessage(conversationId: string | null) {
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((state) => state.user?.id) ?? "me";
  return useMutation({
    mutationFn: async (data: { body: string; clientMessageId: string }) => {
      if (!conversationId) throw new Error("Chưa chọn cuộc trò chuyện");
      return (await messagingApi.sendMessage(conversationId, data)).data;
    },
    onMutate: async ({ body, clientMessageId }) => {
      if (!conversationId) return undefined;
      const key = ["conversations", conversationId, "messages"] as const;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key) as
        InfiniteData<MessagingPage<MessageItem>> | undefined;
      const optimistic: MessageItem = {
        id: `local:${clientMessageId}`,
        conversationId,
        senderId: currentUserId,
        clientMessageId,
        type: "TEXT",
        body,
        createdAt: new Date().toISOString(),
        editedAt: null,
        deletedAt: null,
        status: "sending",
      };
      queryClient.setQueryData(key, (old: typeof previous) =>
        upsertMessage(old, optimistic),
      );
      return { previous, clientMessageId };
    },
    onSuccess: (message, _variables, context) => {
      if (!conversationId) return;
      queryClient.setQueryData(
        ["conversations", conversationId, "messages"],
        (old: InfiniteData<MessagingPage<MessageItem>> | undefined) =>
          replaceMessage(
            old,
            context?.clientMessageId ?? message.clientMessageId,
            {
              ...message,
              status: "sent",
            },
          ),
      );
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (_error, _variables, context) => {
      if (!conversationId || !context) return;
      queryClient.setQueryData(
        ["conversations", conversationId, "messages"],
        (old: InfiniteData<MessagingPage<MessageItem>> | undefined) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              data: page.data.map((message) =>
                message.clientMessageId === context.clientMessageId &&
                message.senderId === currentUserId
                  ? { ...message, status: "failed" as const }
                  : message,
              ),
            })),
          };
        },
      );
    },
  });
}
