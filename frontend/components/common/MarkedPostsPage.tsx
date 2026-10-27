'use client';

import { useAuthStore } from '@/stores/authStore';
import { postsApi } from '@/features/posts/api';
import { usePostList } from '@/features/posts/hooks/usePostList';
import { usePostInteractions } from '@/features/posts/hooks/usePostInteractions';
import { EmptyState } from '@/components/ui/EmptyState';
import { InfiniteScrollTrigger } from './InfiniteScrollTrigger';
import { PostList } from './PostList';

export function MarkedPostsPage({ kind }: { kind: 'bookmarks' | 'liked' }) {
  const user = useAuthStore((state) => state.user);
  const query = usePostList([kind], kind === 'bookmarks' ? postsApi.getBookmarks : postsApi.getLikedPosts, Boolean(user));
  const actions = usePostInteractions();
  const posts = query.data?.pages.flatMap((page) => page.items) ?? [];
  const label = kind === 'bookmarks' ? 'đã lưu' : 'đã thích';

  if (!user) return <EmptyState title={`Đăng nhập để xem bài ${label}`} description="Danh sách này chỉ dành cho tài khoản của bạn." href="/login" action="Đăng nhập" />;
  if (query.isPending) return <p className="p-8 text-center text-[13px] text-[#8e8ca3]">Đang tải bài {label}…</p>;
  if (query.isError && posts.length === 0 && !query.isFetchNextPageError) return <EmptyState title={`Không thể tải bài ${label}`} description="Vui lòng kiểm tra kết nối và thử lại." />;
  if (posts.length === 0 && !query.hasNextPage && !query.isFetchNextPageError) return <EmptyState title={`Chưa có bài viết ${label}`} description={kind === 'bookmarks' ? 'Nhấn biểu tượng dấu trang ở một bài viết để tìm lại nhanh hơn.' : 'Nhấn biểu tượng trái tim ở một bài viết để xem lại tại đây.'} href="/explore" action="Khám phá bài viết" />;

  return <div className="feed-stack">
    {posts.length > 0 && <PostList posts={posts} currentUserId={user.id} onLike={actions.toggleLike} onRepost={actions.toggleRepost} onBookmark={actions.toggleBookmark} onDelete={actions.deletePost} />}
    {posts.length === 0 && !query.isFetchNextPageError && <p className="p-6 text-center text-[12px] text-[#8e8ca3]">Đang tìm bài {label} có thể xem…</p>}
    <InfiniteScrollTrigger hasNextPage={Boolean(query.hasNextPage)} isFetchingNextPage={query.isFetchingNextPage} isFetchNextPageError={query.isFetchNextPageError} fetchNextPage={query.fetchNextPage} endMessage={posts.length > 0 ? 'Bạn đã xem hết bài viết.' : undefined} />
  </div>;
}
