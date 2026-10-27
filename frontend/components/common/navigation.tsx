export type NavKey = 'feed' | 'explore' | 'notifications' | 'bookmarks' | 'liked';

export const navigationItems: { key: NavKey; href: string; label: string; glyph: string; color: string }[] = [
  { key: 'feed', href: '/feed', label: 'Bảng tin', glyph: '✦', color: 'bg-[#e9e7ff] text-[#7b78ff]' },
  { key: 'explore', href: '/explore', label: 'Khám phá', glyph: '⌕', color: 'bg-[#e8f5ff] text-[#4d9fe7]' },
  { key: 'notifications', href: '/notifications', label: 'Thông báo', glyph: '🔔', color: 'bg-[#fff0f3] text-[#ee7790]' },
  { key: 'bookmarks', href: '/bookmarks', label: 'Đã lưu', glyph: '◇', color: 'bg-[#fff2e0] text-[#c58f28]' },
  { key: 'liked', href: '/liked', label: 'Đã thích', glyph: '♡', color: 'bg-[#fff0f3] text-[#ee7790]' },
];

export function NavIcon({ name, className = 'h-6 w-6' }: { name: NavKey; className?: string }) {
  const common = { className, fill: 'none', stroke: 'currentColor', viewBox: '0 0 24 24' };
  switch (name) {
    case 'feed': return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>;
    case 'explore': return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
    case 'notifications': return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>;
    case 'bookmarks': return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>;
    case 'liked': return <svg {...common}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364 0L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>;
  }
}
