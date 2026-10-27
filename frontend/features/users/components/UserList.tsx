import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Author } from '@/types/api';

export function UserList({ users, emptyText }: { users: Author[]; emptyText: string }) {
  if (users.length === 0) return <EmptyState title={emptyText} description="Danh sách sẽ được cập nhật khi có hoạt động mới." />;
  return <div className="feed-stack">{users.map((user) => <Link key={user.id} href={`/${user.username}`} className="soft-list-row flex gap-3 p-5 transition-colors hover:bg-[#f9f8ff]"><Avatar src={user.avatarUrl} displayName={user.displayName} size={42} /><div className="min-w-0"><p className="truncate text-[13px] font-extrabold text-[#1c1b29]">{user.displayName}</p><p className="text-[12px] text-[#8e8ca3]">@{user.username}</p>{user.bio && <p className="mt-2 line-clamp-2 text-[13px] text-[#4a4860]">{user.bio}</p>}</div></Link>)}</div>;
}
