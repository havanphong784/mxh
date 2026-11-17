"use client";

import { useEffect, useMemo, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { getApiErrorMessage } from "@/lib/api-error";
import { useAuthStore } from "@/stores/authStore";
import { useMessagingStore } from "@/stores/messagingStore";
import type { ConversationItem } from "@/types/api";
import { messagingApi } from "../api";
import { updateConversation, upsertConversation } from "../cache";
import type { ConversationData } from "../cache";
import {
  useConversation,
  useConversations,
  useMessages,
  useSendMessage,
} from "../hooks";
import { ConversationList } from "./ConversationList";
import { ConversationView } from "./ConversationView";

export function MessagingView() {
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const currentUserId = useAuthStore((state) => state.user?.id) ?? "me";
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const activeConversationId = searchParams.get("conversation");
  const requestedUserId = searchParams.get("user");
  const handledUserRequest = useRef<string | null>(null);

  const conversationsQuery = useConversations(authenticated);
  const openConversation = useMutation({
    mutationFn: (targetUserId: string) =>
      messagingApi.getOrCreateDirect(targetUserId),
    onSuccess: (response, targetUserId) => {
      const conversation = response.data;
      queryClient.setQueryData(
        ["conversations", conversation.id, "detail"],
        conversation,
      );
      queryClient.setQueryData<ConversationData>(["conversations"], (old) =>
        upsertConversation(old, conversation),
      );
      queryClient.invalidateQueries({
        queryKey: ["conversations"],
        exact: true,
      });
      // A response from an earlier profile must not change the current selection.
      if (handledUserRequest.current === targetUserId) {
        router.replace(`/messages?conversation=${conversation.id}`, {
          scroll: false,
        });
      }
    },
  });
  const { mutate: openDirectConversation } = openConversation;

  useEffect(() => {
    if (!authenticated || !requestedUserId) {
      handledUserRequest.current = null;
      return;
    }
    if (handledUserRequest.current === requestedUserId) return;
    handledUserRequest.current = requestedUserId;
    openDirectConversation(requestedUserId);
  }, [authenticated, requestedUserId, openDirectConversation]);

  const conversations = useMemo(() => {
    const items =
      conversationsQuery.data?.pages.flatMap((page) => page.data) ?? [];
    return [...new Map(items.map((item) => [item.id, item])).values()];
  }, [conversationsQuery.data]);

  const conversationQuery = useConversation(
    activeConversationId,
    authenticated,
  );
  const activeConversation =
    conversationQuery.data ??
    conversations.find(
      (conversation) => conversation.id === activeConversationId,
    ) ??
    null;
  const messagesQuery = useMessages(
    activeConversationId,
    authenticated && Boolean(activeConversation),
  );
  const sendMessage = useSendMessage(activeConversationId);
  const markRead = useMutation({
    mutationFn: (conversationId: string) =>
      messagingApi.markRead(conversationId),
    onSuccess: (response, conversationId) => {
      queryClient.setQueryData<ConversationData>(["conversations"], (old) =>
        updateConversation(old, conversationId, (conversation) => ({
          ...conversation,
          unreadCount: 0,
        })),
      );
      queryClient.setQueryData<ConversationItem>(
        ["conversations", conversationId, "detail"],
        (old) => (old ? { ...old, unreadCount: 0 } : old),
      );
      useMessagingStore.getState().setUnreadCount(response.data.unreadCount);
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
  const { mutate: markConversationRead, isPending: isMarkingRead } = markRead;
  const readFailed =
    markRead.isError && markRead.variables === activeConversationId;

  useEffect(() => {
    if (
      activeConversation?.unreadCount &&
      messagesQuery.isSuccess &&
      !messagesQuery.isFetching &&
      !isMarkingRead &&
      !readFailed
    ) {
      markConversationRead(activeConversation.id);
    }
  }, [
    activeConversation?.id,
    activeConversation?.unreadCount,
    messagesQuery.isSuccess,
    messagesQuery.isFetching,
    isMarkingRead,
    readFailed,
    markConversationRead,
  ]);

  if (!authenticated) {
    return (
      <EmptyState
        title="Đăng nhập để nhắn tin"
        description="Kết nối riêng tư với những người bạn quan tâm sau khi đăng nhập."
        href="/login"
        action="Đăng nhập"
      />
    );
  }

  const messageItems =
    messagesQuery.data?.pages.flatMap((page) => page.data) ?? [];
  const mobileConversationOpen = Boolean(
    activeConversationId || requestedUserId,
  );
  const openFailed = Boolean(
    requestedUserId &&
    openConversation.isError &&
    openConversation.variables === requestedUserId,
  );
  const conversationError = openFailed
    ? getApiErrorMessage(
        openConversation.error,
        "Không thể mở cuộc trò chuyện. Vui lòng thử lại.",
      )
    : !activeConversation && conversationQuery.isError
      ? getApiErrorMessage(
          conversationQuery.error,
          "Không thể tải cuộc trò chuyện. Vui lòng thử lại.",
        )
      : null;

  function send(body: string, existingClientMessageId?: string) {
    const clientMessageId = existingClientMessageId ?? crypto.randomUUID();
    sendMessage.mutate({ body, clientMessageId });
  }

  return (
    <div className="surface-card flex min-h-[calc(100dvh-150px)] flex-col overflow-hidden md:h-[calc(100dvh-128px)] md:min-h-[560px]">
      {readFailed && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 bg-[#fff0f3] px-4 py-3 text-[12px] text-[#b34f69]"
        >
          <span>Không thể đánh dấu đã đọc.</span>
          <button
            type="button"
            onClick={() =>
              activeConversationId && markConversationRead(activeConversationId)
            }
            className="shrink-0 font-bold underline"
          >
            Thử lại
          </button>
        </div>
      )}
      <div className="flex min-h-0 flex-1">
        <div
          className={`${mobileConversationOpen ? "hidden md:flex" : "flex"} min-h-0 min-w-0 flex-1 md:flex-none`}
        >
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId}
            onSelect={(conversation) =>
              router.replace(`/messages?conversation=${conversation.id}`, {
                scroll: false,
              })
            }
            isLoading={conversationsQuery.isPending}
            error={
              conversationsQuery.isError &&
              !conversationsQuery.isFetchNextPageError
                ? getApiErrorMessage(
                    conversationsQuery.error,
                    "Không thể tải danh sách trò chuyện.",
                  )
                : null
            }
            onRetry={() => conversationsQuery.refetch()}
            hasNextPage={Boolean(conversationsQuery.hasNextPage)}
            isFetchingNextPage={conversationsQuery.isFetchingNextPage}
            isFetchNextPageError={conversationsQuery.isFetchNextPageError}
            fetchNextPage={() => conversationsQuery.fetchNextPage()}
          />
        </div>
        <div
          className={`${mobileConversationOpen ? "flex" : "hidden md:flex"} min-w-0 flex-1`}
        >
          <ConversationView
            conversation={requestedUserId ? null : activeConversation}
            isLoadingConversation={
              Boolean(requestedUserId && !openFailed) ||
              Boolean(
                activeConversationId &&
                !activeConversation &&
                conversationQuery.isPending,
              )
            }
            conversationError={conversationError}
            onRetryConversation={() =>
              requestedUserId
                ? openDirectConversation(requestedUserId)
                : conversationQuery.refetch()
            }
            messages={messageItems}
            isLoadingMessages={messagesQuery.isPending}
            messagesError={
              messagesQuery.isError && !messagesQuery.isFetchNextPageError
                ? getApiErrorMessage(
                    messagesQuery.error,
                    "Không thể tải tin nhắn. Vui lòng thử lại.",
                  )
                : null
            }
            onRetryMessages={() => messagesQuery.refetch()}
            currentUserId={currentUserId}
            hasNextPage={Boolean(messagesQuery.hasNextPage)}
            isFetchingNextPage={messagesQuery.isFetchingNextPage}
            isFetchNextPageError={messagesQuery.isFetchNextPageError}
            fetchNextPage={() => messagesQuery.fetchNextPage()}
            onSend={send}
            onRetry={(message) =>
              send(message.body ?? "", message.clientMessageId)
            }
            isSending={sendMessage.isPending}
            onBack={() => {
              handledUserRequest.current = null;
              router.replace("/messages", { scroll: false });
            }}
          />
        </div>
      </div>
    </div>
  );
}
