import type { Metadata } from "next";
import { MarkedPostsPage } from "@/components/common/MarkedPostsPage";

export const metadata: Metadata = {
  title: "Bài viết đã lưu | MXH",
  description: "Xem lại các bài viết và nội dung bạn đã lưu.",
};

export default function BookmarksPage() {
  return <MarkedPostsPage kind="bookmarks" />;
}
