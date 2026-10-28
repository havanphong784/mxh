import type { Metadata } from "next";
import { UserConnectionPage } from "@/components/common/UserConnectionPage";

interface ConnectionPageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({
  params,
}: ConnectionPageProps): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `Người theo dõi ${username} | MXH`,
    description: `Danh sách người dùng đang theo dõi ${username} trên MXH.`,
  };
}

export default async function FollowersPage({ params }: ConnectionPageProps) {
  const { username } = await params;
  return <UserConnectionPage username={username} kind="followers" />;
}
