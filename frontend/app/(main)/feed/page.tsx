'use client';

import { useFeed } from '@/features/posts/hooks/useFeed';
import { PostList } from '@/components/common/PostList';
import { InfiniteScrollTrigger } from '@/components/common/InfiniteScrollTrigger';
import { NewPostBanner } from '@/features/posts/components/NewPostBanner';
import { PostComposer } from '@/features/posts/components/PostComposer';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';
import { useNotificationStore } from '@/stores/notificationStore';

export default function FeedPage() {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
    isLoading,
    isError,
    refetch,
    toggleLike,
    toggleRepost,
    toggleBookmark,
    deletePost,
  } = useFeed(isAuthenticated);
  const hasNewFeedPosts = useNotificationStore((state) => state.hasNewFeedPosts);
  const clearNewFeedNotice = useNotificationStore((state) => state.clearNewFeedPosts);
  const posts = data?.pages.flatMap((page) => page.items) ?? [];

  const handleRefreshFeed = () => {
    clearNewFeedNotice();
    refetch();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="feed-stack">
      {/* Khung đăng bài mới */}
      <PostComposer onSuccess={() => refetch()} />

      {/* Banner thông báo bài mới từ WebSocket */}
      {hasNewFeedPosts && <NewPostBanner onClick={handleRefreshFeed} />}

      {/* Danh sách bài viết */}
      {!isAuthenticated ? (
        <div className="surface-card px-6 py-14 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-[20px] bg-[#fff0f3] text-[25px] text-[#ff8da1]">♡</span><h2 className="mt-5 text-[18px] font-extrabold">Đăng nhập để xem bảng tin</h2><p className="mt-2 text-[13px] text-[#6d6a82]">Bảng tin hiển thị bài viết của những người bạn theo dõi.</p><Link href="/login" className="mt-5 inline-flex rounded-full bg-[#7b78ff] px-5 py-2.5 text-[13px] font-bold text-white">Đăng nhập</Link></div>
      ) : isLoading ? (
        <div className="surface-card p-8 text-center text-[13px] text-[#8e8ca3]">Đang tải bảng tin...</div>
      ) : isError && posts.length === 0 && !isFetchNextPageError ? (
        <div className="surface-card px-6 py-14 text-center"><h2 className="text-[18px] font-extrabold">Không thể tải bảng tin</h2><p className="mt-2 text-[13px] text-[#6d6a82]">Kiểm tra kết nối rồi thử lại.</p><button onClick={() => refetch()} className="mt-5 rounded-full bg-[#eeedff] px-5 py-2.5 text-[13px] font-bold text-[#7b78ff]">Thử lại</button></div>
      ) : (
        <div className="feed-stack">
          <PostList posts={posts} currentUserId={currentUserId} onLike={toggleLike} onRepost={toggleRepost} onBookmark={toggleBookmark} onDelete={deletePost} />
          <InfiniteScrollTrigger hasNextPage={Boolean(hasNextPage)} isFetchingNextPage={isFetchingNextPage} isFetchNextPageError={isFetchNextPageError} fetchNextPage={fetchNextPage} endMessage="Bạn đã xem hết bài viết." />
        </div>
      )}
    </div>
  );
}
