"use client";

import React, { useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";
import { refreshSession } from "@/lib/axios";
import { useAuthStore } from "@/stores/authStore";

export function Providers({ children }: { children: React.ReactNode }) {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let active = true;
    const tokenBeforeRefresh = useAuthStore.getState().accessToken;
    // Khôi phục phiên đăng nhập khi F5 hoặc mở tab mới bằng cookie HttpOnly
    refreshSession()
      .catch(() => {
        if (
          active &&
          useAuthStore.getState().accessToken === tokenBeforeRefresh
        )
          clearAuth();
      })
      .finally(() => {
        if (active) setIsInitializing(false);
      });
    return () => {
      active = false;
    };
  }, [clearAuth]);

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#f4f2fa] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#efedf7] border-t-[#1c1b29] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
