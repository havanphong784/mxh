export type NavKey =
  "feed" | "explore" | "notifications" | "bookmarks" | "liked";

export const navigationItems: {
  key: NavKey;
  href: string;
  label: string;
  glyph: string;
  color: string;
}[] = [
  {
    key: "feed",
    href: "/feed",
    label: "Bảng tin",
    glyph: "✦",
    color: "bg-[#e9e7ff] text-[#7b78ff]",
  },
  {
    key: "explore",
    href: "/explore",
    label: "Khám phá",
    glyph: "⌕",
    color: "bg-[#e8f5ff] text-[#4d9fe7]",
  },
  {
    key: "notifications",
    href: "/notifications",
    label: "Thông báo",
    glyph: "🔔",
    color: "bg-[#fff0f3] text-[#ee7790]",
  },
  {
    key: "bookmarks",
    href: "/bookmarks",
    label: "Đã lưu",
    glyph: "◇",
    color: "bg-[#fff2e0] text-[#c58f28]",
  },
  {
    key: "liked",
    href: "/liked",
    label: "Đã thích",
    glyph: "♡",
    color: "bg-[#fff0f3] text-[#ee7790]",
  },
];

export { NavIcon } from "./NavIcon";
