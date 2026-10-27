'use client';

import { useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { postsApi } from '@/features/posts/api';
import { InteractivePostCard } from '@/features/posts/components/InteractivePostCard';
import { usePostInteractions } from '@/features/posts/hooks/usePostInteractions';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';

export default function BookmarksPage() {
  const user = useAuthStore((state) => state.user);
  const query = useInfiniteQuery({
    queryKey: ['posts', 'bookmarks'],
    queryFn: async ({ pageParam }) => (await postsApi.getBookmarks(pageParam)).data,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(user),
  });
  const actions = usePostInteractions();
  const posts = query.data?.pages.flatMap((page) => page.items) ?? [];
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = query;

  useEffect(() => {
    if (user && posts.length === 0 && hasNextPage && !isFetchingNextPage && !isFetchNextPageError) {
      fetchNextPage();
    }
  }, [user, posts.length, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  if (!user) return <EmptyState title="Đăng nhập để xem bài đã lưu" description="Bài viết bạn đánh dấu sẽ được giữ riêng tại đây." href="/login" action="Đăng nhập" />;
  if (query.isLoading) return <p className="p-8 text-center text-[13px] text-[#8e8ca3]">Đang tải bài đã lưu…</p>;
  if (query.isError && posts.length === 0) return <div className="feed-stack"><EmptyState title="Không thể tải bài đã lưu" description="Vui lòng thử lại sau ít phút." />{isFetchNextPageError && <Button variant="ghost" onClick={() => fetchNextPage()}>Thử tải lại</Button>}</div>;
  if (posts.length === 0 && hasNextPage) return <p className="p-8 text-center text-[13px] text-[#8e8ca3]">Đang tìm bài đã lưu có thể xem…</p>;
  if (posts.length === 0) return <EmptyState title="Chưa lưu bài viết nào" description="Nhấn biểu tượng dấu trang ở một bài viết để tìm lại nhanh hơn." href="/explore" action="Khám phá bài viết" />;
  return <div className="feed-stack">{posts.map((post) => <InteractivePostCard key={post.id} post={post} currentUserId={user.id} onLike={actions.toggleLike} onRepost={actions.toggleRepost} onBookmark={actions.toggleBookmark} onDelete={actions.deletePost} />)}{hasNextPage && <div className="p-4 text-center"><Button variant="ghost" onClick={() => fetchNextPage()} isLoading={isFetchingNextPage}>{isFetchNextPageError ? 'Thử tải lại' : 'Xem thêm'}</Button></div>}</div>;
}
