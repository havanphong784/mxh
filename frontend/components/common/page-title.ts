export function pageTitle(pathname: string): string {
  if (pathname === '/feed') return 'Bảng tin';
  if (pathname === '/explore') return 'Khám phá';
  if (pathname === '/bookmarks') return 'Đã lưu';
  if (pathname === '/liked') return 'Đã thích';
  if (pathname === '/notifications') return 'Thông báo';
  if (pathname === '/settings/security') return 'Bảo mật tài khoản';
  if (pathname.startsWith('/post/')) return 'Thảo luận';
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 2 && segments[1] === 'followers') return 'Người theo dõi';
  if (segments.length === 2 && segments[1] === 'following') return 'Đang theo dõi';
  return 'Hồ sơ';
}
