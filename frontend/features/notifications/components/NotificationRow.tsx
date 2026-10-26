'use client';

import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import type { NotificationItem } from '@/types/api';
import { getNotificationPresentation } from '../presentation';

export function NotificationRow({ item, onRead }: { item: NotificationItem; onRead: () => void }) {
  const view = getNotificationPresentation(item);
  const actorName = item.actor?.displayName ?? 'Một người dùng';
  return <Link href={view.href} onClick={onRead} className={`flex gap-3 border-b border-[#d5d5d5] p-4 transition-colors hover:bg-[#fafafa] ${item.isRead ? 'bg-white' : 'bg-[#efefef]/50'}`}><Avatar src={item.actor?.avatarUrl} displayName={actorName} size={42} /><div className="min-w-0 flex-1"><p className="text-[13px] leading-5"><b>{actorName}</b> {view.action}</p>{item.post?.content && <p className="mt-1 truncate text-[13px] text-[#969696]">{item.post.content}</p>}<time className="mt-1 block text-[12px] text-[#969696]">{new Date(item.createdAt).toLocaleString('vi-VN')}</time></div>{!item.isRead && <span className="mt-2 h-2 w-2 rounded-full bg-[#0095f6]" aria-label="Chưa đọc" />}</Link>;
}
