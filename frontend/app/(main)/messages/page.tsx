import type { Metadata } from "next";
import { Suspense } from "react";
import { MessagingView } from "@/features/messaging/components/MessagingView";

export const metadata: Metadata = {
  title: "Tin nhắn | MXH",
  description: "Trò chuyện riêng tư với cộng đồng MXH.",
};

export default function MessagesPage() {
  return (
    <Suspense
      fallback={
        <div className="surface-card flex min-h-[560px] items-center justify-center text-[13px] text-[#8e8ca3]">
          Đang tải tin nhắn…
        </div>
      }
    >
      <MessagingView />
    </Suspense>
  );
}
