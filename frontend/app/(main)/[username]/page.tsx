import type { Metadata } from "next";
import { UserProfileView } from "@/features/users/components/UserProfileView";

interface ProfilePageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({
  params,
}: ProfilePageProps): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `${username} | MXH`,
    description: `Khám phá những khoảnh khắc và chia sẻ mới nhất từ ${username} trên MXH.`,
    openGraph: {
      title: `${username} trên MXH`,
      description: `Xem các bài viết và kết nối cùng ${username}.`,
      type: "profile",
      url: `/${username}`,
    },
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { username } = await params;
  return <UserProfileView username={username} />;
}
