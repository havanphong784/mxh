"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useNotificationStore } from "@/stores/notificationStore";
import { useMessagingStore } from "@/stores/messagingStore";
import { initSocket, disconnectSocket } from "@/lib/socket";
import { useQueryClient } from "@tanstack/react-query";
import type { InfiniteData } from "@tanstack/react-query";
import type {
  ConversationItem,
  CursorDataPage,
  MessageItem,
  MessagingPage,
  NewMessageEvent,
  NotificationItem,
} from "@/types/api";
import { notificationsApi } from "@/features/notifications/api";
import { upsertNotification } from "@/features/notifications/cache";
import { messagingApi } from "@/features/messaging/api";
import { upsertMessage, updateConversation } from "@/features/messaging/cache";

export function useSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);
  const showNewFeedPosts = useNotificationStore((s) => s.showNewFeedPosts);
  const setMessageUnreadCount = useMessagingStore((s) => s.setUnreadCount);
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
        if (useAuthStore.getState().accessToken === accessToken) {
          setUnreadCount(response.data.count);
        }
      })
      .catch(() => undefined);
    messagingApi
      .unreadCount()
      .then((response) => {
        if (useAuthStore.getState().accessToken === accessToken) {
          setMessageUnreadCount(response.data.count);
        }
      })
      .catch(() => undefined);

    socket.on("notification:unread-count", (data: { count: number }) => {
      if (useAuthStore.getState().accessToken === accessToken) {
        setUnreadCount(data.count);
      }
    });

    socket.on("notification:new", (notif: NotificationItem) => {
      if (useAuthStore.getState().accessToken !== accessToken) return;
      queryClient.setQueryData<InfiniteData<CursorDataPage<NotificationItem>>>(
        ["notifications"],
        (old) => upsertNotification(old, notif),
      );
    });

    socket.on("conversation:unread-count", (data: { count: number }) => {
      if (useAuthStore.getState().accessToken === accessToken) {
        setMessageUnreadCount(data.count);
      }
    });

    socket.on("conversation:new-message", (event: NewMessageEvent) => {
      if (useAuthStore.getState().accessToken !== accessToken) return;
      const currentUserId = useAuthStore.getState().user?.id;
      const message = event.message;
      queryClient.setQueryData<
        InfiniteData<MessagingPage<MessageItem>> | undefined
      >(["conversations", event.conversationId, "messages"], (old) =>
        upsertMessage(old, message),
      );
      queryClient.setQueryData<
        InfiniteData<MessagingPage<ConversationItem>> | undefined
      >(["conversations"], (old) =>
        updateConversation(old, event.conversationId, (conversation) => ({
          ...conversation,
          lastMessage: message,
          updatedAt: message.createdAt,
          unreadCount:
            event.senderId === currentUserId
              ? conversation.unreadCount
              : conversation.unreadCount + 1,
        })),
      );
      queryClient.invalidateQueries({
        queryKey: ["conversations", event.conversationId, "messages"],
        refetchType: "none",
      });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });

    socket.on(
      "conversation:read",
      (data: { conversationId: string; userId: string }) => {
        if (useAuthStore.getState().accessToken !== accessToken) return;
        if (data.userId !== useAuthStore.getState().user?.id) return;
        queryClient.setQueryData<
          InfiniteData<MessagingPage<ConversationItem>> | undefined
        >(["conversations"], (old) =>
          updateConversation(old, data.conversationId, (conversation) => ({
            ...conversation,
            unreadCount: 0,
          })),
        );
      },
    );

    socket.on("feed:new-post", () => {
      if (useAuthStore.getState().accessToken === accessToken) {
        showNewFeedPosts();
      }
    });

    return () => {
      disconnectSocket();
    };
  }, [
    isAuthenticated,
    accessToken,
    setUnreadCount,
    showNewFeedPosts,
    setMessageUnreadCount,
    queryClient,
  ]);
}
