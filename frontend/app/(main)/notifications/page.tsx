'use client';

import { useAuthStore } from '@/stores/authStore';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import { NotificationRow } from '@/features/notifications/components/NotificationRow';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';

export default function NotificationsPage() {
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const query = useNotifications(authenticated);
  if (!authenticated) return <EmptyState title="Đăng nhập để xem thông báo" description="Tương tác mới với tài khoản của bạn sẽ xuất hiện tại đây." href="/login" action="Đăng nhập" />;
  if (query.isLoading) return <p className="p-8 text-center text-[13px] text-[#969696]">Đang tải thông báo…</p>;
  if (query.isError) return <EmptyState title="Không thể tải thông báo" description="Đã có lỗi kết nối. Vui lòng thử lại sau." />;
  const items = query.data?.pages.flatMap((page) => page.data) ?? [];
  if (items.length === 0) return <EmptyState title="Chưa có thông báo" description="Khi có người tương tác với bạn, thông báo sẽ xuất hiện tại đây." />;
  return <div><div className="flex justify-end border-b border-[#d5d5d5] p-3"><Button variant="ghost" onClick={() => query.markAll()} isLoading={query.isMarkingAll}>Đánh dấu đã đọc</Button></div>{items.map((item) => <NotificationRow key={item.id} item={item} onRead={() => !item.isRead && query.markRead(item.id)} />)}{query.hasNextPage && <div className="p-4 text-center"><Button variant="ghost" onClick={() => query.fetchNextPage()} isLoading={query.isFetchingNextPage}>Xem thêm</Button></div>}</div>;
}
