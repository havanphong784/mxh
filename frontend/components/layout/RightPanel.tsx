"use client";

import Link from "next/link";
import { Avatar } from "@/components/ui/Avatar";
import { useAuthStore } from "@/stores/authStore";
import { CalendarCard } from "./CalendarCard";

export function RightPanel() {
  const username = useAuthStore((state) => state.user?.username);
  const displayName = useAuthStore((state) => state.user?.displayName);
  const avatarUrl = useAuthStore((state) => state.user?.avatarUrl);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <aside
      className="hidden min-h-0 overflow-y-auto overscroll-contain bg-white px-5 pb-8 pt-8 xl:block"
      aria-label="Thông tin cá nhân và lối tắt"
    >
      <div>
        <div className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(135deg,#eeecff,#fce9f2_56%,#dff5ff)] p-5">
          <div
            className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/45 blur-xl"
            aria-hidden="true"
          />
          <div
            className="absolute -bottom-14 -left-7 h-32 w-32 rounded-full bg-[#b7b1ff]/50 blur-xl"
            aria-hidden="true"
          />
          <div className="relative">
            <p className="eyebrow">Hồ sơ của bạn</p>
            {isAuthenticated && username ? (
              <>
                <div className="mt-5 inline-flex rounded-full bg-white p-1 shadow-[0_8px_20px_rgba(123,120,255,.17)]">
                  <Avatar src={avatarUrl} displayName={displayName} size={64} />
                </div>
                <h2 className="mt-3 text-[18px] font-extrabold leading-tight text-[#1c1b29]">
                  {displayName}
                </h2>
                <p className="mt-1 text-[12px] font-semibold text-[#6d6a82]">
                  @{username}
                </p>
                <Link
                  href={`/${username}`}
                  className="mt-5 inline-flex rounded-full bg-[#7b78ff] px-4 py-2 text-[11px] font-bold text-white shadow-[0_8px_18px_rgba(123,120,255,.25)] transition hover:bg-[#6763eb]"
                >
                  Xem hồ sơ ↗
                </Link>
              </>
            ) : (
              <>
                <h2 className="mt-9 text-[18px] font-extrabold text-[#1c1b29]">
                  Cùng trò chuyện nhé!
                </h2>
                <p className="mt-2 text-[12px] leading-5 text-[#6d6a82]">
                  Đăng nhập để chia sẻ bài viết và kết nối với mọi người.
                </p>
                <Link
                  href="/login"
                  className="mt-5 inline-flex rounded-full bg-[#7b78ff] px-4 py-2 text-[11px] font-bold text-white"
                >
                  Đăng nhập ↗
                </Link>
              </>
            )}
          </div>
        </div>
        <CalendarCard />
      </div>
    </aside>
  );
}
