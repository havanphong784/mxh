import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import type { Author } from '@/types/api';

export function UserRow({ user, action }: { user: Author; action?: React.ReactNode }) {
  return <div className="soft-list-row flex items-center gap-3 p-4 transition-colors hover:bg-[#f9f8ff]">
    <Link href={`/${user.username}`} aria-label={`Hồ sơ ${user.displayName}`} className="shrink-0"><Avatar src={user.avatarUrl} displayName={user.displayName} size={44} /></Link>
    <div className="min-w-0 flex-1"><Link href={`/${user.username}`} className="block truncate text-[13px] font-extrabold text-[#1c1b29]">{user.displayName}</Link><p className="truncate text-[11px] text-[#8e8ca3]">@{user.username}</p>{user.bio && <p className="mt-1 line-clamp-2 text-[12px] text-[#6d6a82]">{user.bio}</p>}</div>
    {action}
  </div>;
}
