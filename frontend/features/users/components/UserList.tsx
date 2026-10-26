import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Author } from '@/types/api';

export function UserList({ users, emptyText }: { users: Author[]; emptyText: string }) {
  if (users.length === 0) return <EmptyState title={emptyText} description="Danh sách sẽ được cập nhật khi có hoạt động mới." />;
  return <div>{users.map((user) => <Link key={user.id} href={`/${user.username}`} className="flex gap-3 border-b border-[#d5d5d5] p-4 hover:bg-[#fafafa]"><Avatar src={user.avatarUrl} displayName={user.displayName} size={42} /><div className="min-w-0"><p className="truncate text-[13px] font-semibold">{user.displayName}</p><p className="text-[13px] text-[#969696]">@{user.username}</p>{user.bio && <p className="mt-1 line-clamp-2 text-[13px] text-[#424242]">{user.bio}</p>}</div></Link>)}</div>;
}
