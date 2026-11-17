"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useNotificationStore } from "@/stores/notificationStore";
import { useMessagingStore } from "@/stores/messagingStore";
import { navigationItems } from "@/components/common/navigation";

export function DiscoveryPanel() {
  const pathname = usePathname();
  const unreadCount = useNotificationStore((state) => state.unreadCount);
  const messageUnreadCount = useMessagingStore((state) => state.unreadCount);

  return (
    <aside
      className="hidden min-h-0 overflow-y-auto overscroll-contain px-4 pb-8 pt-9 xl:block"
      aria-label="Lối tắt"
    >
      <h2 className="mt-2 px-2 text-[20px] font-extrabold leading-tight tracking-[-0.04em] text-[#1c1b29]">
        Dành cho bạn
      </h2>
      <nav className="mt-7 flex flex-col gap-2">
        {navigationItems.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-[18px] px-2 py-2 text-[12px] font-bold transition-colors ${active ? "bg-white text-[#1c1b29] shadow-[0_8px_24px_rgba(123,120,255,.09)]" : "text-[#6d6a82] hover:bg-white/70"}`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-[12px] text-[19px] ${link.color}`}
                aria-hidden="true"
              >
                {link.glyph}
              </span>
              <span>{link.label}</span>
              {link.href === "/notifications" && unreadCount > 0 && (
                <span className="ml-auto rounded-full bg-[#ff8da1] px-1.5 py-0.5 text-[10px] text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
              {link.href === "/messages" && messageUnreadCount > 0 && (
                <span className="ml-auto rounded-full bg-[#45ad8a] px-1.5 py-0.5 text-[10px] text-white">
                  {messageUnreadCount > 99 ? "99+" : messageUnreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
