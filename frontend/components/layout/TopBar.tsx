'use client';

import React from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useAuth } from '@/features/auth/hooks/useAuth';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export function TopBar() {
  const { user, isAuthenticated } = useAuthStore();
  const { logout } = useAuth();

  return (
    <header className="h-[56px] w-full bg-[#ffffff]/90 backdrop-blur-md border-b border-[#d5d5d5] sticky top-0 z-20 flex items-center justify-between px-6">
      <div className="w-[100px] flex items-center">
        <span className="text-[12px] font-semibold text-[#969696] tracking-wider uppercase">Beta</span>
      </div>

      <div className="font-bold text-[16px] text-[#000000] tracking-tight">
        MXH
      </div>

      <div className="w-[100px] flex justify-end items-center space-x-3">
        {!isAuthenticated ? (
          <Link href="/login">
            <Button variant="primary" className="text-[12px] py-1 px-3">
              Log in
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
