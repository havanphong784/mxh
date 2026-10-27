'use client';

import { useParams } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { postsApi } from '@/features/posts/api';
import { usePostList } from '@/features/posts/hooks/usePostList';
import { usePostInteractions } from '@/features/posts/hooks/usePostInteractions';
import { ThreadViewUI } from '@/features/posts/components/ThreadViewUI';
import { PostComposer } from '@/features/posts/components/PostComposer';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { isActivePost } from '@/features/posts/post-state';

export default function PostPage() {
  const id = useParams<{ id: string }>().id;
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const postQuery = useQuery({ queryKey: ['posts', 'detail', id], queryFn: async () => (await postsApi.getPost(id)).data });
  const ancestorsQuery = useQuery({ queryKey: ['posts', 'ancestors', id], queryFn: async () => (await postsApi.getAncestors(id)).data.ancestors });
  const repliesQuery = usePostList(['replies', id], (cursor) => postsApi.getReplies(id, cursor), !postQuery.data || isActivePost(postQuery.data));
  const actions = usePostInteractions();

  if (postQuery.isError) return <EmptyState title="Không tìm thấy bài viết" description="Bài viết có thể đã bị xóa hoặc bạn không có quyền xem." href="/explore" action="Về trang khám phá" />;
  if (!postQuery.data) return <p className="p-8 text-center text-[13px] text-[#8e8ca3]">Đang tải cuộc thảo luận…</p>;
  const replies = repliesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const canReply = isActivePost(postQuery.data);

  return <><ThreadViewUI post={postQuery.data} ancestors={ancestorsQuery.data ?? []} replies={replies} currentUserId={user?.id} isLoading={postQuery.isLoading} onLike={actions.toggleLike} onRepost={actions.toggleRepost} onBookmark={actions.toggleBookmark} onDelete={actions.deletePost} replyComposerNode={!canReply ? null : user ? <PostComposer parentId={id} placeholder="Viết phản hồi…" onSuccess={() => queryClient.invalidateQueries({ queryKey: ['posts', 'replies', id] })} /> : <div className="p-4 text-center text-[13px] text-[#8e8ca3]">Đăng nhập để tham gia thảo luận.</div>} />{ancestorsQuery.isError && <p className="p-4 text-center text-[13px] text-red-600">Không thể tải chuỗi bài viết trước đó.</p>}{repliesQuery.isError && <p className="p-4 text-center text-[13px] text-red-600">Không thể tải phản hồi.</p>}{repliesQuery.hasNextPage && <div className="p-4 text-center"><Button variant="ghost" onClick={() => repliesQuery.fetchNextPage()} isLoading={repliesQuery.isFetchingNextPage}>Xem thêm phản hồi</Button></div>}</>;
}
