'use client';

import React from 'react';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useNotificationStore} from '@/stores/notificationStore';
import {useAuthStore} from '@/stores/authStore';
import {Avatar} from '@/components/ui/Avatar';

export function Sidebar() {
  const pathname = usePathname();
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const user = useAuthStore((s) => s.user);

  const navItems = [
    {
      label: 'Trang chủ',
      href: '/feed',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      label: 'Khám phá',
      href: '/explore',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
    },
    {
      label: 'Thông báo',
      href: '/notifications',
      badge: unreadCount,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      label: 'Đã lưu',
      href: '/bookmarks',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="z-30 hidden h-full min-h-0 select-none flex-col items-center justify-between overflow-y-auto bg-white py-7 md:flex">
      <div className="flex flex-col items-center gap-9">
        <Link href="/feed" aria-label="Trang chủ MXH" className="grid h-10 w-10 place-items-center rounded-[15px] bg-[#7b78ff] text-[11px] font-extrabold tracking-[-0.04em] text-white shadow-[0_8px_18px_rgba(123,120,255,.25)] transition hover:scale-105">
          MXH
        </Link>
        <nav className="flex flex-col gap-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative grid h-11 w-11 place-items-center rounded-[16px] transition-colors ${
                  isActive ? 'bg-[#eeedff] text-[#7b78ff]' : 'text-[#8e8ca3] hover:bg-[#f4f2fa] hover:text-[#7b78ff]'
                }`}
                title={item.label}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.icon}
                {item.badge && item.badge > 0 ? (
                  <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff8da1] px-1 text-[9px] font-bold text-white">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="rounded-full bg-[#fff0f3] p-1">
        {user ? (
          <Link href={`/${user.username}`} title={`@${user.username}`}>
            <Avatar src={user.avatarUrl} displayName={user.displayName} size={36} />
          </Link>
        ) : (
          <Link href="/login" aria-label="Đăng nhập" className="grid h-9 w-9 place-items-center rounded-full text-[20px] font-bold text-[#ff8da1] hover:bg-white" title="Đăng nhập">
            ↗
          </Link>
        )}
      </div>
    </aside>
  );
}
