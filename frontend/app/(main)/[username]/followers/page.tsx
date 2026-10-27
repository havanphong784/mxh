'use client';

import { useParams } from 'next/navigation';
import { UserConnectionPage } from '@/components/common/UserConnectionPage';

export default function FollowersPage() {
  const { username } = useParams<{ username: string }>();
  return <UserConnectionPage username={username} kind="followers" />;
}
