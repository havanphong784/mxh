"use client";

import { useEffect, useMemo, useRef } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { InfiniteScrollTrigger } from "@/components/common/InfiniteScrollTrigger";
import type { ConversationItem, MessageItem } from "@/types/api";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer } from "./MessageComposer";

export function ConversationView({
  conversation,
  isLoadingConversation,
  conversationError,
  onRetryConversation,
  messages,
  isLoadingMessages,
  messagesError,
  onRetryMessages,
  currentUserId,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  fetchNextPage,
  onSend,
  onRetry,
  isSending,
  onBack,
}: {
  conversation: ConversationItem | null;
  isLoadingConversation: boolean;
  conversationError: string | null;
  onRetryConversation: () => unknown;
  messages: MessageItem[];
  isLoadingMessages: boolean;
  messagesError: string | null;
  onRetryMessages: () => unknown;
  currentUserId: string;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: () => unknown;
  onSend: (body: string) => void;
  onRetry: (message: MessageItem) => void;
  isSending: boolean;
  onBack: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRootRef = useRef<HTMLDivElement>(null);
  const previousConversationId = useRef<string | null>(null);
  const previousLatestMessageId = useRef<string | null>(null);
  const sortedMessages = useMemo(
    () =>
      [...messages].sort((a, b) => {
        const byTime =
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return byTime || a.id.localeCompare(b.id);
      }),
    [messages],
  );

  useEffect(() => {
    const latestMessage = sortedMessages[sortedMessages.length - 1];
    const conversationChanged =
      previousConversationId.current !== conversation?.id;
    const latestMessageChanged =
      previousLatestMessageId.current !== latestMessage?.id;

    if (latestMessage && (conversationChanged || latestMessageChanged)) {
      bottomRef.current?.scrollIntoView({
        behavior:
          previousConversationId.current && !conversationChanged
            ? "smooth"
            : "auto",
      });
    }

    previousConversationId.current = conversation?.id ?? null;
    previousLatestMessageId.current = latestMessage?.id ?? null;
  }, [conversation?.id, sortedMessages]);

  if (!conversation) {
    return (
      <section className="relative grid min-h-[560px] flex-1 place-items-center bg-[linear-gradient(145deg,#fbfaff,#f2f6ff)] p-5">
        <button
          type="button"
          onClick={onBack}
          className="absolute left-4 top-4 rounded-full bg-white px-4 py-2 text-[12px] font-bold text-[#6965e8] md:hidden"
        >
          ← Danh sách
        </button>
        <div
          className="max-w-[300px] text-center"
          role={conversationError ? "alert" : "status"}
        >
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-[24px] bg-[#eeedff] text-[28px] text-[#7b78ff]">
            ✦
          </div>
          <h2 className="mt-5 text-[20px] font-extrabold text-[#1c1b29]">
            {isLoadingConversation
              ? "Đang mở cuộc trò chuyện…"
              : conversationError
                ? "Không thể mở cuộc trò chuyện"
                : "Chọn một cuộc trò chuyện"}
          </h2>
          <p className="mt-2 text-[13px] leading-5 text-[#6d6a82]">
            {conversationError ??
              (isLoadingConversation
                ? "Vui lòng chờ trong giây lát."
                : "Các tin nhắn riêng tư của bạn sẽ xuất hiện ở đây.")}
          </p>
          {conversationError && (
            <button
              type="button"
              onClick={onRetryConversation}
              className="mt-4 rounded-full bg-[#eeedff] px-4 py-2 text-[12px] font-bold text-[#6965e8]"
            >
              Thử lại
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-h-[calc(100dvh-150px)] flex-1 flex-col bg-[linear-gradient(145deg,#fbfaff,#f2f6ff)] md:min-h-0">
      <header className="flex items-center gap-3 border-b border-[#f0eef8] bg-white px-4 py-3 sm:px-5">
        <button
          type="button"
          onClick={onBack}
          className="grid h-9 w-9 place-items-center rounded-[12px] bg-[#f4f2fa] text-[#6965e8] md:hidden"
          aria-label="Quay lại danh sách"
        >
          ←
        </button>
        <Avatar
          src={conversation.participant.avatarUrl}
          displayName={conversation.participant.displayName}
          size={42}
        />
        <div className="min-w-0">
          <h2 className="truncate text-[14px] font-extrabold text-[#1c1b29]">
            {conversation.participant.displayName}
          </h2>
          <p className="truncate text-[11px] text-[#8e8ca3]">
            @{conversation.participant.username}
          </p>
        </div>
      </header>
      <div
        ref={scrollRootRef}
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6"
      >
        {messagesError && (
          <div
            role="alert"
            className="py-6 text-center text-[12px] text-[#b34f69]"
          >
            <p>{messagesError}</p>
            <button
              type="button"
              onClick={onRetryMessages}
              className="mt-3 rounded-full bg-[#eeedff] px-4 py-2 font-bold text-[#6965e8]"
            >
              Thử tải lại tin nhắn
            </button>
          </div>
        )}
        <InfiniteScrollTrigger
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          isFetchNextPageError={isFetchNextPageError}
          fetchNextPage={fetchNextPage}
          rootRef={scrollRootRef}
          loadingMessage="Đang tải tin nhắn cũ…"
        />
        <div className="space-y-3">
          {isLoadingMessages && sortedMessages.length === 0 ? (
            <p
              role="status"
              className="py-20 text-center text-[13px] text-[#8e8ca3]"
            >
              Đang tải tin nhắn…
            </p>
          ) : sortedMessages.length === 0 && !messagesError ? (
            <div className="py-20 text-center">
              <p className="text-[13px] font-bold text-[#6d6a82]">
                Bắt đầu cuộc trò chuyện
              </p>
              <p className="mt-1 text-[12px] text-[#aaa7bb]">
                Hãy gửi lời chào đầu tiên.
              </p>
            </div>
          ) : (
            sortedMessages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                currentUserId={currentUserId}
                onRetry={() => onRetry(message)}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <MessageComposer
        key={conversation.id}
        onSend={onSend}
        disabled={
          isSending ||
          isLoadingMessages ||
          Boolean(messagesError && messages.length === 0)
        }
      />
    </section>
  );
}
