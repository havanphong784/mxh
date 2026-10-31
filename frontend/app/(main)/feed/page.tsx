import type { Metadata } from "next";
import { FeedView } from "@/features/posts/components/FeedView";

export const metadata: Metadata = {
  title: "Bảng tin | MXH",
  description: "Cập nhật những chia sẻ và tin tức mới nhất từ bạn bè.",
};

export default function FeedPage() {
  return <FeedView />;
}
