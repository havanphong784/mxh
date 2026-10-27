'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import { Avatar } from '@/components/ui/Avatar';
import { navigationItems, NavIcon } from '@/components/common/navigation';

export function MobileNav() {
  const pathname = usePathname();
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const user = useAuthStore((state) => state.user);

  return <nav className="fixed bottom-[max(12px,env(safe-area-inset-bottom))] left-3 right-3 z-30 flex h-[62px] select-none items-center justify-around rounded-[22px] bg-white/95 px-1 shadow-[0_14px_40px_rgba(90,75,140,.20)] backdrop-blur-xl md:hidden">
    {navigationItems.map((item) => <Link key={item.key} href={item.href} aria-label={item.label} aria-current={pathname === item.href ? 'page' : undefined} className={`relative rounded-[14px] p-2 transition-colors ${pathname === item.href ? 'bg-[#eeedff] text-[#7b78ff]' : 'text-[#8e8ca3]'}`}>
      <NavIcon name={item.key} className="h-5 w-5" />
      {item.key === 'notifications' && unreadCount > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#ff8da1]" />}
    </Link>)}
    <Link href={user ? `/${user.username}` : '/login'} aria-label={user ? 'Hồ sơ' : 'Đăng nhập'} className="rounded-[14px] p-1.5">
      {user ? <Avatar src={user.avatarUrl} displayName={user.displayName} size={24} /> : <svg className="h-5 w-5 text-[#8e8ca3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0" /></svg>}
    </Link>
  </nav>;
}
