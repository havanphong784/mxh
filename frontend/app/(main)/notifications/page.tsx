"use client";

import { useAuthStore } from "@/stores/authStore";
import { useNotifications } from "@/features/notifications/hooks/useNotifications";
import { NotificationRow } from "@/features/notifications/components/NotificationRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { PostFeedSkeleton } from "@/components/ui/PostSkeleton";
import { InfiniteScrollTrigger } from "@/components/common/InfiniteScrollTrigger";

export default function NotificationsPage() {
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const query = useNotifications(authenticated);
  if (!authenticated)
    return (
      <EmptyState
        title="Đăng nhập để xem thông báo"
        description="Tương tác mới với tài khoản của bạn sẽ xuất hiện tại đây."
        href="/login"
        action="Đăng nhập"
      />
    );
  if (query.isLoading) return <PostFeedSkeleton count={3} />;
  const items = query.data?.pages.flatMap((page) => page.data) ?? [];
  if (query.isError && items.length === 0 && !query.isFetchNextPageError)
    return (
      <EmptyState
        title="Không thể tải thông báo"
        description="Đã có lỗi kết nối. Vui lòng thử lại sau."
      />
    );
  if (items.length === 0 && !query.hasNextPage && !query.isFetchNextPageError)
    return (
      <EmptyState
        title="Chưa có thông báo"
        description="Khi có người tương tác với bạn, thông báo sẽ xuất hiện tại đây."
      />
    );
  return (
    <div className="feed-stack">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          onClick={() => query.markAll()}
          isLoading={query.isMarkingAll}
        >
          Đánh dấu đã đọc
        </Button>
      </div>
      {items.map((item) => (
        <NotificationRow
          key={item.id}
          item={item}
          onRead={() => !item.isRead && query.markRead(item.id)}
        />
      ))}
      <InfiniteScrollTrigger
        hasNextPage={Boolean(query.hasNextPage)}
        isFetchingNextPage={query.isFetchingNextPage}
        isFetchNextPageError={query.isFetchNextPageError}
        fetchNextPage={query.fetchNextPage}
      />
    </div>
  );
}
