'use client';

import { postsApi } from '@/features/posts/api';
import { usePostList } from '@/features/posts/hooks/usePostList';
import { usePostInteractions } from '@/features/posts/hooks/usePostInteractions';
import { InteractivePostCard } from '@/features/posts/components/InteractivePostCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';

export default function ExplorePage() {
  const userId = useAuthStore((state) => state.user?.id);
  const query = usePostList(['explore'], postsApi.getExplore);
  const actions = usePostInteractions();
  const posts = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isLoading) return <p className="p-8 text-center text-[13px] text-[#969696]">Đang tải bài viết…</p>;
  if (query.isError) return <EmptyState title="Không thể tải khám phá" description="Đã có lỗi kết nối. Vui lòng thử lại." />;
  if (posts.length === 0) return <EmptyState title="Chưa có bài viết công khai" description="Những bài viết mới từ cộng đồng sẽ xuất hiện tại đây." />;

  return <div>{posts.map((post) => <InteractivePostCard key={post.id} post={post} currentUserId={userId} onLike={actions.toggleLike} onRepost={actions.toggleRepost} onBookmark={actions.toggleBookmark} onDelete={actions.deletePost} />)}{query.hasNextPage && <div className="p-4 text-center"><Button variant="ghost" onClick={() => query.fetchNextPage()} isLoading={query.isFetchingNextPage}>Xem thêm</Button></div>}</div>;
}
