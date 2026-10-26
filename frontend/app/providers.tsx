'use client';

import React, { useEffect, useState } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { refreshClient } from '@/lib/axios';
import { useAuthStore } from '@/stores/authStore';
import type { Author, RefreshResponse } from '@/types/api';

export function Providers({ children }: { children: React.ReactNode }) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Khôi phục phiên đăng nhập khi F5 hoặc mở tab mới bằng cookie HttpOnly
    refreshClient
      .post<RefreshResponse>('/auth/refresh')
      .then(async (res) => {
        const me = await refreshClient.get<Author>('/auth/me', {
          headers: { Authorization: `Bearer ${res.data.accessToken}` },
        });
        setAuth(me.data, res.data.accessToken);
      })
      .catch(() => {
        clearAuth();
      })
      .finally(() => {
        setIsInitializing(false);
      });
  }, [setAuth, clearAuth]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#fafafa] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#d5d5d5] border-t-[#000000] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
