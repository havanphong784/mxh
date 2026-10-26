'use client';

import React from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useAuth } from '@/features/auth/hooks/useAuth';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { usePathname } from 'next/navigation';

export function TopBar() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { logout } = useAuth();
  const pathname = usePathname();
  const title = pathname === '/feed'
    ? 'Dành cho bạn'
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
    <header className="h-[56px] w-full bg-[#ffffff]/90 backdrop-blur-md border-b border-[#d5d5d5] sticky top-0 z-20 flex items-center justify-between px-6">
      <div className="w-[100px] flex items-center">
        <Link href="/feed" className="text-[18px] font-black tracking-[-0.08em]" aria-label="Trang chủ MXH">
          MXH
        </Link>
      </div>

      <h1 className="font-semibold text-[15px] text-[#000000]">{title}</h1>

      <div className="w-[100px] flex justify-end items-center space-x-3">
        {!isAuthenticated ? (
          <Link href="/login">
            <Button variant="primary" className="text-[12px] py-1.5 px-3.5">
              Đăng nhập
            </Button>
          </Link>
        ) : (
          <button
            onClick={() => logout()}
            className="text-[12px] font-semibold text-[#969696] hover:text-[#000000] cursor-pointer transition-colors"
            title="Đăng xuất"
          >
            Đăng xuất
          </button>
        )}
      </div>
    </header>
  );
}
