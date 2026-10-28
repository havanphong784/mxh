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
    title: `Đang theo dõi bởi ${username} | MXH`,
    description: `Danh sách người dùng mà ${username} đang theo dõi trên MXH.`,
  };
}

export default async function FollowingPage({ params }: ConnectionPageProps) {
  const { username } = await params;
  return <UserConnectionPage username={username} kind="following" />;
}
