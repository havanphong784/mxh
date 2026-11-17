"use client";

import type { MessageItem } from "@/types/api";

export function MessageBubble({
  message,
  currentUserId,
  onRetry,
}: {
  message: MessageItem;
  currentUserId: string;
  onRetry?: () => void;
}) {
  const own = message.senderId === currentUserId || message.senderId === "me";
  const time = new Date(message.createdAt).toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className={`flex ${own ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[82%] sm:max-w-[70%] ${own ? "items-end" : "items-start"} flex flex-col`}
      >
        <div
          className={`rounded-[20px] px-4 py-2.5 text-[13px] leading-5 ${own ? "rounded-br-[7px] bg-[#7b78ff] text-white" : "rounded-bl-[7px] bg-[#f4f2fa] text-[#3e3b52]"} ${message.status === "failed" ? "ring-2 ring-[#ff8da1]/50" : ""}`}
        >
          {message.body ?? "Tin nhắn đã bị xóa"}
        </div>
        <span
          className={`mt-1 px-1 text-[10px] ${message.status === "failed" ? "text-[#e36d86]" : "text-[#aaa7bb]"}`}
        >
          {message.status === "sending" ? (
            "Đang gửi…"
          ) : message.status === "failed" ? (
            <button
              type="button"
              onClick={onRetry}
              className="font-bold underline underline-offset-2"
            >
              Gửi thất bại · thử lại
            </button>
          ) : (
            time
          )}
        </span>
      </div>
    </div>
  );
}
