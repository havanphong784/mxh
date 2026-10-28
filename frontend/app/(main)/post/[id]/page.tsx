import type { Metadata } from "next";
import { InteractivePostView } from "@/features/posts/components/InteractivePostView";

interface PostDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: PostDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Bài viết thảo luận | MXH",
    description: "Xem chi tiết cuộc trò chuyện và thảo luận trên MXH.",
    openGraph: {
      title: "Bài viết thảo luận | MXH",
      description: "Xem chi tiết cuộc trò chuyện và thảo luận trên MXH.",
      type: "article",
      url: `/post/${id}`,
    },
  };
}

export default async function PostDetailPage({ params }: PostDetailPageProps) {
  const { id } = await params;
  return <InteractivePostView postId={id} />;
}
