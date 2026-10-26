'use client';

import React, { useEffect, useRef } from 'react';
import { useFeed } from '@/features/posts/hooks/useFeed';
import { InteractivePostCard } from '@/features/posts/components/InteractivePostCard';
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
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.5 }
    );

    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleRefreshFeed = () => {
    clearNewFeedNotice();
    refetch();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div>
      {/* Khung đăng bài mới */}
      <PostComposer onSuccess={() => refetch()} />

      {/* Banner thông báo bài mới từ WebSocket */}
      {hasNewFeedPosts && <NewPostBanner onClick={handleRefreshFeed} />}

      {/* Danh sách bài viết */}
      {!isAuthenticated ? (
        <div className="px-6 py-16 text-center"><h2 className="text-[15px] font-semibold">Đăng nhập để xem bảng tin</h2><p className="mt-1 text-[13px] text-[#969696]">Bảng tin hiển thị bài viết của những người bạn theo dõi.</p><Link href="/login" className="mt-4 inline-flex rounded-full bg-black px-4 py-2 text-[13px] font-semibold text-white">Đăng nhập</Link></div>
      ) : isLoading ? (
        <div className="p-8 text-center text-[#969696] text-[13px]">Đang tải bảng tin...</div>
      ) : isError ? (
        <div className="px-6 py-16 text-center"><h2 className="text-[15px] font-semibold">Không thể tải bảng tin</h2><p className="mt-1 text-[13px] text-[#969696]">Kiểm tra kết nối rồi thử lại.</p><button onClick={() => refetch()} className="mt-4 rounded-full border border-[#0095f6] px-4 py-2 text-[13px] font-semibold text-[#0095f6]">Thử lại</button></div>
      ) : (
        <div>
          {data?.pages
            .flatMap((page) => page.items)
            .map((post) => (
              <InteractivePostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                onLike={toggleLike}
                onRepost={toggleRepost}
                onBookmark={toggleBookmark}
                onDelete={deletePost}
              />
            ))}

          {/* Sentinel phần tử đáy trang kích hoạt tải thêm */}
          <div ref={sentinelRef} className="py-6 text-center text-[13px] text-[#969696]">
            {isFetchingNextPage
              ? 'Đang tải thêm bài viết...'
              : !hasNextPage
              ? 'Bạn đã xem hết bài viết.'
              : ''}
          </div>
        </div>
      )}
    </div>
  );
}
