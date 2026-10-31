import type { Metadata } from "next";
import { MarkedPostsPage } from "@/components/common/MarkedPostsPage";

export const metadata: Metadata = {
  title: "Bài viết đã thích | MXH",
  description: "Danh sách các bài viết bạn đã bày tỏ cảm xúc yêu thích.",
};

export default function LikedPage() {
  return <MarkedPostsPage kind="liked" />;
}
