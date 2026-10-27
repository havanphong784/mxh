'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import { Avatar } from '@/components/ui/Avatar';

export function MobileNav() {
  const pathname = usePathname();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const user = useAuthStore((s) => s.user);

  return (
    <nav className="fixed bottom-[max(12px,env(safe-area-inset-bottom))] left-3 right-3 z-30 flex h-[62px] select-none items-center justify-around rounded-[22px] bg-white/95 px-2 shadow-[0_14px_40px_rgba(90,75,140,.20)] backdrop-blur-xl md:hidden">
      <Link
        href="/feed"
        aria-label="Trang chủ"
        className={`rounded-[14px] p-2.5 transition-colors ${pathname === '/feed' ? 'bg-[#eeedff] text-[#7b78ff]' : 'text-[#8e8ca3]'}`}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      </Link>

      <Link
        href="/explore"
        aria-label="Khám phá"
        className={`rounded-[14px] p-2.5 transition-colors ${pathname === '/explore' ? 'bg-[#eeedff] text-[#7b78ff]' : 'text-[#8e8ca3]'}`}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </Link>

      <Link
        href="/notifications"
        aria-label="Thông báo"
        className={`relative rounded-[14px] p-2.5 transition-colors ${pathname === '/notifications' ? 'bg-[#eeedff] text-[#7b78ff]' : 'text-[#8e8ca3]'}`}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#ff8da1]" />
        )}
      </Link>

      <Link
        href="/bookmarks"
        aria-label="Đã lưu"
        className={`rounded-[14px] p-2.5 transition-colors ${pathname === '/bookmarks' ? 'bg-[#eeedff] text-[#7b78ff]' : 'text-[#8e8ca3]'}`}
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      </Link>

      <Link
        href={user ? `/${user.username}` : '/login'}
        aria-label={user ? 'Hồ sơ' : 'Đăng nhập'}
        className="rounded-[14px] p-2"
      >
        {user ? (
          <Avatar src={user.avatarUrl} displayName={user.displayName} size={24} />
        ) : (
          <svg className="h-6 w-6 text-[#8e8ca3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.1a7.5 7.5 0 0115 0" />
          </svg>
        )}
      </Link>
    </nav>
  );
}
