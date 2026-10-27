'use client';

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
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.pagination.page < lastPage.pagination.totalPages ? lastPage.pagination.page + 1 : undefined,
    enabled: Boolean(user),
  });
  const actions = usePostInteractions();
  if (!user) return <EmptyState title="Đăng nhập để xem bài đã lưu" description="Bài viết bạn đánh dấu sẽ được giữ riêng tại đây." href="/login" action="Đăng nhập" />;
  if (query.isLoading) return <p className="p-8 text-center text-[13px] text-[#8e8ca3]">Đang tải bài đã lưu…</p>;
  if (query.isError) return <EmptyState title="Không thể tải bài đã lưu" description="Vui lòng thử lại sau ít phút." />;
  const posts = query.data?.pages.flatMap((page) => page.items) ?? [];
  if (posts.length === 0) return <EmptyState title="Chưa lưu bài viết nào" description="Nhấn biểu tượng dấu trang ở một bài viết để tìm lại nhanh hơn." href="/explore" action="Khám phá bài viết" />;
  return <div className="feed-stack">{posts.map((post) => <InteractivePostCard key={post.id} post={post} currentUserId={user.id} onLike={actions.toggleLike} onRepost={actions.toggleRepost} onBookmark={actions.toggleBookmark} onDelete={actions.deletePost} />)}{query.hasNextPage && <div className="p-4 text-center"><Button variant="ghost" onClick={() => query.fetchNextPage()} isLoading={query.isFetchingNextPage}>Xem thêm</Button></div>}</div>;
}
