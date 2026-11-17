"use client";

import { useRef } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { InfiniteScrollTrigger } from "@/components/common/InfiniteScrollTrigger";
import type { ConversationItem } from "@/types/api";

export interface ConversationListProps {
  conversations: ConversationItem[];
  activeConversationId: string | null;
  onSelect: (conversation: ConversationItem) => void;
  isLoading: boolean;
  error: string | null;
  onRetry: () => unknown;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isFetchNextPageError: boolean;
  fetchNextPage: () => unknown;
}

function formatConversationTime(value: string) {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

export function ConversationList({
  conversations,
  activeConversationId,
  onSelect,
  isLoading,
  error,
  onRetry,
  hasNextPage,
  isFetchingNextPage,
  isFetchNextPageError,
  fetchNextPage,
}: ConversationListProps) {
  const scrollRootRef = useRef<HTMLDivElement>(null);

  return (
    <aside className="flex min-h-0 w-full flex-col border-b border-[#f0eef8] bg-white md:w-[300px] md:border-b-0 md:border-r">
      <div className="border-b border-[#f0eef8] px-5 py-5">
        <p className="eyebrow">Kết nối riêng tư</p>
        <h1 className="mt-1 text-[24px] font-extrabold tracking-[-0.04em] text-[#1c1b29]">
          Tin nhắn
        </h1>
        <p className="mt-1 text-[12px] text-[#8e8ca3]">
          Trò chuyện với những người bạn quan tâm.
        </p>
      </div>
      <div ref={scrollRootRef} className="min-h-0 flex-1 overflow-y-auto p-2">
        {error && (
          <div
            role="alert"
            className="px-4 py-6 text-center text-[12px] text-[#b34f69]"
          >
            <p>{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 rounded-full bg-[#eeedff] px-4 py-2 font-bold text-[#6965e8]"
            >
              Thử lại
            </button>
          </div>
        )}
        {isLoading && conversations.length === 0 ? (
          <p
            role="status"
            className="px-5 py-12 text-center text-[12px] text-[#8e8ca3]"
          >
            Đang tải danh sách trò chuyện…
          </p>
        ) : conversations.length === 0 && !error ? (
          <div className="px-5 py-12 text-center text-[12px] leading-5 text-[#8e8ca3]">
            Chưa có cuộc trò chuyện nào.
            <br />
            Mở hồ sơ một người để bắt đầu nhắn tin.
          </div>
        ) : (
          conversations.map((conversation) => {
            const active = conversation.id === activeConversationId;
            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelect(conversation)}
                className={`flex w-full items-center gap-3 rounded-[18px] px-3 py-3 text-left transition-colors ${active ? "bg-[#eeedff]" : "hover:bg-[#f8f7fc]"}`}
              >
                <div className="relative shrink-0">
                  <Avatar
                    src={conversation.participant.avatarUrl}
                    displayName={conversation.participant.displayName}
                    size={44}
                  />
                  {conversation.unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff8da1] px-1 text-[10px] font-extrabold text-white">
                      {conversation.unreadCount > 9
                        ? "9+"
                        : conversation.unreadCount}
                    </span>
                  )}
                </div>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[13px] font-extrabold text-[#1c1b29]">
                      {conversation.participant.displayName}
                    </span>
                    <span className="shrink-0 text-[10px] text-[#aaa7bb]">
                      {formatConversationTime(conversation.updatedAt)}
                    </span>
                  </span>
                  <span
                    className={`mt-1 block truncate text-[11px] ${conversation.unreadCount > 0 ? "font-bold text-[#6965e8]" : "text-[#8e8ca3]"}`}
                  >
                    {conversation.lastMessage?.body ??
                      "Bắt đầu cuộc trò chuyện"}
                  </span>
                </span>
              </button>
            );
          })
        )}
        <InfiniteScrollTrigger
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          isFetchNextPageError={isFetchNextPageError}
          fetchNextPage={fetchNextPage}
          rootRef={scrollRootRef}
          loadingMessage="Đang tải thêm cuộc trò chuyện…"
        />
        {hasNextPage && !isFetchingNextPage && !isFetchNextPageError && (
          <button
            type="button"
            onClick={fetchNextPage}
            className="mx-auto my-3 block rounded-full bg-[#eeedff] px-4 py-2 text-[12px] font-bold text-[#6965e8]"
          >
            Tải thêm cuộc trò chuyện
          </button>
        )}
      </div>
    </aside>
  );
}
