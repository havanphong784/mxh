'use client';

import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { CalendarCard } from './CalendarCard';

export function RightPanel() {
  const user = useAuthStore((state) => state.user);
  const unreadCount = useNotificationStore((state) => state.unreadCount);

  return <aside className="hidden min-h-0 overflow-y-auto overscroll-contain bg-white px-5 pb-8 pt-8 xl:block" aria-label="Thông tin cá nhân và lối tắt">
    <div>
      <div className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(135deg,#eeecff,#fce9f2_56%,#dff5ff)] p-5">
        <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/45 blur-xl" aria-hidden="true" />
        <div className="absolute -bottom-14 -left-7 h-32 w-32 rounded-full bg-[#b7b1ff]/50 blur-xl" aria-hidden="true" />
        <div className="relative">
          <p className="eyebrow">Hồ sơ của bạn</p>
          {user ? <>
            <div className="mt-5 inline-flex rounded-full bg-white p-1 shadow-[0_8px_20px_rgba(123,120,255,.17)]"><Avatar src={user.avatarUrl} displayName={user.displayName} size={64} /></div>
            <h2 className="mt-3 text-[18px] font-extrabold leading-tight text-[#1c1b29]">{user.displayName}</h2>
            <p className="mt-1 text-[12px] font-semibold text-[#6d6a82]">@{user.username}</p>
            <Link href={`/${user.username}`} className="mt-5 inline-flex rounded-full bg-[#7b78ff] px-4 py-2 text-[11px] font-bold text-white shadow-[0_8px_18px_rgba(123,120,255,.25)] transition hover:bg-[#6763eb]">Xem hồ sơ ↗</Link>
          </> : <>
            <h2 className="mt-9 text-[18px] font-extrabold text-[#1c1b29]">Cùng trò chuyện nhé!</h2>
            <p className="mt-2 text-[12px] leading-5 text-[#6d6a82]">Đăng nhập để chia sẻ bài viết và kết nối với mọi người.</p>
            <Link href="/login" className="mt-5 inline-flex rounded-full bg-[#7b78ff] px-4 py-2 text-[11px] font-bold text-white">Đăng nhập ↗</Link>
          </>}
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between"><h3 className="text-[15px] font-extrabold text-[#1c1b29]">Khám phá nhanh</h3><span className="text-[18px] text-[#7b78ff]" aria-hidden="true">✦</span></div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link href="/explore" className="group rounded-[20px] bg-[#eef7ff] p-4 transition hover:-translate-y-0.5"><span className="grid h-9 w-9 place-items-center rounded-[12px] bg-[#64b5f6] text-[18px] text-white" aria-hidden="true">⌕</span><span className="mt-4 block text-[12px] font-bold text-[#1c1b29]">Bài công khai</span><span className="mt-1 block text-[10px] text-[#6d6a82]">Từ cộng đồng ↗</span></Link>
          <Link href="/bookmarks" className="group rounded-[20px] bg-[#fff3e1] p-4 transition hover:-translate-y-0.5"><span className="grid h-9 w-9 place-items-center rounded-[12px] bg-[#ffd166] text-[18px] text-[#1c1b29]" aria-hidden="true">◇</span><span className="mt-4 block text-[12px] font-bold text-[#1c1b29]">Bài đã lưu</span><span className="mt-1 block text-[10px] text-[#6d6a82]">Xem lại ↗</span></Link>
        </div>
      </div>

      <Link href="/notifications" className="mt-7 flex items-center gap-3 rounded-[20px] bg-[#fff0f3] p-4 transition hover:bg-[#ffe8ee]"><span className="grid h-10 w-10 place-items-center rounded-[14px] bg-[#ff8da1] text-xl text-white" aria-hidden="true">♡</span><span className="min-w-0 flex-1"><span className="block text-[12px] font-bold text-[#1c1b29]">Thông báo</span><span className="mt-0.5 block text-[10px] text-[#6d6a82]">{unreadCount > 0 ? `${unreadCount} mục chưa đọc` : 'Bạn đã xem hết'}</span></span><span className="text-[#ff8da1]" aria-hidden="true">↗</span></Link>
      <CalendarCard />
      <p className="mt-8 text-center text-[10px] leading-4 text-[#8e8ca3]">MXH · Một góc nhỏ để kết nối mỗi ngày</p>
    </div>
  </aside>;
}
