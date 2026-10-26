'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNotificationStore } from '@/stores/notificationStore';
import { useAuthStore } from '@/stores/authStore';
import { Avatar } from '@/components/ui/Avatar';

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
    <aside className="hidden md:flex flex-col items-center justify-between w-[80px] h-screen sticky top-0 bg-[#ffffff] border-r border-[#d5d5d5] py-6 z-30 select-none">
      <div className="flex flex-col items-center space-y-6">
        <Link href="/feed" aria-label="Trang chủ MXH" className="grid h-11 w-11 place-items-center rounded-full border border-[#000000] text-[15px] font-black tracking-[-0.08em] hover:bg-[#efefef] transition-colors">
          MXH
        </Link>
        <nav className="flex flex-col space-y-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative p-3 rounded-full hover:bg-[#efefef] transition-colors ${
                  isActive ? 'text-[#000000] bg-[#efefef]/60' : 'text-[#424242]'
                }`}
                title={item.label}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.icon}
                {item.badge && item.badge > 0 ? (
                  <span className="absolute top-1 right-1 bg-[#0095f6] text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <div>
        {user ? (
          <Link href={`/${user.username}`} title={`@${user.username}`}>
            <Avatar src={user.avatarUrl} displayName={user.displayName} size={36} />
          </Link>
        ) : (
          <Link href="/login" className="text-[12px] font-semibold text-[#0095f6] hover:underline">
            Đăng nhập
          </Link>
        )}
      </div>
    </aside>
  );
}
