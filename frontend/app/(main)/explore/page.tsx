import type { Metadata } from "next";
import { ExploreView } from "@/features/posts/components/ExploreView";

export const metadata: Metadata = {
  title: "Khám phá | MXH",
  description: "Tìm kiếm bài viết, hình ảnh và kết nối những người bạn mới.",
};

export default function ExplorePage() {
  return <ExploreView />;
}
