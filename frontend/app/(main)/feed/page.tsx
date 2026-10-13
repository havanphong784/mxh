'use client';

import React, { useEffect, useRef } from 'react';
import { useFeed } from '@/features/posts/hooks/useFeed';
import { PostCard } from '@/features/posts/components/PostCard';
import { NewPostBanner } from '@/features/posts/components/NewPostBanner';
import { useSocket } from '@/features/realtime/hooks/useSocket';
import { PostComposer } from '@/features/posts/components/PostComposer';
import { useAuthStore } from '@/stores/authStore';

export default function FeedPage() {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    refetch,
    toggleLike,
  } = useFeed();
  const { hasNewFeedPosts, clearNewFeedNotice } = useSocket();
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
      {isLoading ? (
        <div className="p-8 text-center text-[#969696] text-[13px]">Đang tải bảng tin...</div>
      ) : (
        <div>
          {data?.pages
            .flatMap((page) => page.data)
            .map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUserId}
                onLike={() => toggleLike(post.id, post.interactions.isLiked)}
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
