'use client';

import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import type { NotificationItem } from '@/types/api';
import { getNotificationPresentation } from '../presentation';

export function NotificationRow({ item, onRead }: { item: NotificationItem; onRead: () => void }) {
  const view = getNotificationPresentation(item);
  const actorName = item.actor?.displayName ?? 'Một người dùng';
  return <Link href={view.href} onClick={onRead} className={`soft-list-row flex gap-3 p-5 transition-colors hover:bg-[#f9f8ff] ${item.isRead ? '' : 'ring-1 ring-[#eeedff]'}`}><Avatar src={item.actor?.avatarUrl} displayName={actorName} size={42} /><div className="min-w-0 flex-1"><p className="text-[13px] leading-5 text-[#4a4860]"><b className="text-[#1c1b29]">{actorName}</b> {view.action}</p>{item.post?.content && <p className="mt-1 truncate text-[13px] text-[#8e8ca3]">{item.post.content}</p>}<time className="mt-2 block text-[11px] font-semibold text-[#8e8ca3]">{new Date(item.createdAt).toLocaleString('vi-VN')}</time></div>{!item.isRead && <span className="mt-2 h-2 w-2 rounded-full bg-[#ff8da1]" aria-label="Chưa đọc" />}</Link>;
}
