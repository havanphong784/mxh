'use client';

import React from 'react';
import {useAuthStore} from '@/stores/authStore';
import {useAuth} from '@/features/auth/hooks/useAuth';
import Link from 'next/link';
import {Button} from '@/components/ui/Button';
import {usePathname} from 'next/navigation';

export function TopBar() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { logout } = useAuth();
  const pathname = usePathname();
  const title = pathname === '/feed'
    ? 'Có gì mới?'
    : pathname === '/explore'
      ? 'Khám phá'
      : pathname === '/notifications'
        ? 'Thông báo'
        : pathname === '/bookmarks'
          ? 'Đã lưu'
          : pathname.startsWith('/post/')
            ? 'Thảo luận'
            : 'Hồ sơ';

  return (
    <header className="relative z-20 mb-6 flex w-full items-center justify-between gap-4 pt-2 xl:mb-7">
      <div className="min-w-0 flex-1">
        <p className="eyebrow mb-2">MXH · Không gian của bạn</p>
        <h1 className="text-[24px] font-extrabold leading-[1.15] tracking-[-0.05em] text-[#1c1b29] sm:text-[32px]">{title}<span className="ml-2 text-[#ff8da1]">✦</span></h1>
        <p className="mt-2 hidden text-[12px] font-medium text-[#6d6a82] sm:block">Những câu chuyện nhỏ, những kết nối thật.</p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {!isAuthenticated ? (
          <Link href="/login">
            <Button variant="primary" className="px-4 py-2 text-[12px]">
              Đăng nhập
            </Button>
          </Link>
        ) : (
          <button
            onClick={() => logout()}
            className="rounded-full bg-white px-3 py-2 text-[11px] font-bold text-[#6d6a82] shadow-[0_8px_20px_rgba(123,120,255,.08)] transition-colors hover:text-[#7b78ff]"
            title="Đăng xuất"
          >
            Đăng xuất
          </button>
        )}
      </div>
    </header>
  );
}
