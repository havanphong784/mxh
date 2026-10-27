'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { navigationItems, NavIcon } from '@/components/common/navigation';

export function Sidebar() {
  const pathname = usePathname();
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const user = useAuthStore((state) => state.user);

  return <aside className="z-30 hidden h-full min-h-0 select-none flex-col items-center justify-between overflow-y-auto bg-white py-7 md:flex">
    <div className="flex flex-col items-center gap-9">
      <Link href="/feed" aria-label="Trang chủ MXH" className="grid h-10 w-10 place-items-center rounded-[15px] bg-[#7b78ff] text-[11px] font-extrabold tracking-[-0.04em] text-white shadow-[0_8px_18px_rgba(123,120,255,.25)] transition hover:scale-105">MXH</Link>
      <nav className="flex flex-col gap-3">
        {navigationItems.map((item) => {
          const active = pathname === item.href;
          return <Link key={item.key} href={item.href} title={item.label} aria-label={item.label} aria-current={active ? 'page' : undefined} className={`relative grid h-11 w-11 place-items-center rounded-[16px] transition-colors ${active ? 'bg-[#eeedff] text-[#7b78ff]' : 'text-[#8e8ca3] hover:bg-[#f4f2fa] hover:text-[#7b78ff]'}`}>
            <NavIcon name={item.key} />
            {item.key === 'notifications' && unreadCount > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff8da1] px-1 text-[9px] font-bold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </Link>;
        })}
      </nav>
    </div>
    <div className="rounded-full bg-[#fff0f3] p-1">
      {user ? <Link href={`/${user.username}`} title={`@${user.username}`}><Avatar src={user.avatarUrl} displayName={user.displayName} size={36} /></Link> : <Link href="/login" aria-label="Đăng nhập" className="grid h-9 w-9 place-items-center rounded-full text-[20px] font-bold text-[#ff8da1] hover:bg-white">↗</Link>}
    </div>
  </aside>;
}
