'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotificationStore } from '@/stores/notificationStore';

const links = [
  { href: '/feed', label: 'Bảng tin', icon: '✦', color: 'bg-[#e9e7ff] text-[#7b78ff]' },
  { href: '/explore', label: 'Khám phá', icon: '⌕', color: 'bg-[#e8f5ff] text-[#4d9fe7]' },
  { href: '/bookmarks', label: 'Đã lưu', icon: '◇', color: 'bg-[#fff2e0] text-[#c58f28]' },
  { href: '/notifications', label: 'Thông báo', icon: '♡', color: 'bg-[#fff0f3] text-[#ee7790]' },
];

export function DiscoveryPanel() {
  const pathname = usePathname();
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  return (
    <aside className="hidden min-h-0 overflow-y-auto overscroll-contain px-4 pb-8 pt-9 xl:block" aria-label="Lối tắt">
      <p className="eyebrow px-2">Không gian</p>
      <h2 className="mt-2 px-2 text-[20px] font-extrabold leading-tight tracking-[-0.04em] text-[#1c1b29]">Dành cho bạn</h2>
      <nav className="mt-7 flex flex-col gap-2">
        {links.map((link) => {
          const active = pathname === link.href;
          return <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined}
            className={`flex items-center gap-2 rounded-[18px] px-2 py-2 text-[12px] font-bold transition-colors ${active ? 'bg-white text-[#1c1b29] shadow-[0_8px_24px_rgba(123,120,255,.09)]' : 'text-[#6d6a82] hover:bg-white/70'}`}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[12px] text-[19px] ${link.color}`} aria-hidden="true">{link.icon}</span>
            <span>{link.label}</span>
            {link.href === '/notifications' && unreadCount > 0 && <span className="ml-auto rounded-full bg-[#ff8da1] px-1.5 py-0.5 text-[10px] text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </Link>;
        })}
      </nav>
      <Link href="/explore" className="mt-9 block overflow-hidden rounded-[24px] bg-[linear-gradient(145deg,#8d88ff_0%,#b4a5ff_55%,#f4bad8_100%)] p-4 text-white shadow-[0_14px_24px_-6px_rgba(123,120,255,.35)]">
        <span className="text-[24px]" aria-hidden="true">✷</span>
        <span className="mt-7 block text-[13px] font-extrabold leading-snug">Mở rộng thế giới của bạn</span>
        <span className="mt-2 block text-[11px] font-semibold text-white/90">Xem bài viết từ cộng đồng ↗</span>
      </Link>
      <p className="mt-6 px-2 text-[11px] leading-5 text-[#8e8ca3]">Chia sẻ điều nhỏ bé. Kết nối theo cách của bạn.</p>
    </aside>
  );
}
