"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { postsApi } from "@/features/posts/api";
import { usePostList } from "@/features/posts/hooks/usePostList";
import { usePostInteractions } from "@/features/posts/hooks/usePostInteractions";
import { ThreadViewUI } from "@/features/posts/components/ThreadViewUI";
import { PostComposer } from "@/features/posts/components/PostComposer";
import { EmptyState } from "@/components/ui/EmptyState";
import { PostSkeleton } from "@/components/ui/PostSkeleton";
import { useAuthStore } from "@/stores/authStore";
import { InfiniteScrollTrigger } from "@/components/common/InfiniteScrollTrigger";
import { isActivePost } from "@/features/posts/post-state";

export function InteractivePostView({ postId }: { postId: string }) {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const postQuery = useQuery({
    queryKey: ["posts", "detail", postId],
    queryFn: async () => (await postsApi.getPost(postId)).data,
  });
  const ancestorsQuery = useQuery({
    queryKey: ["posts", "ancestors", postId],
    queryFn: async () => (await postsApi.getAncestors(postId)).data.ancestors,
  });
  const repliesQuery = usePostList(
    ["replies", postId],
    (cursor) => postsApi.getReplies(postId, cursor),
    Boolean(postQuery.data),
  );
  const actions = usePostInteractions();

  if (postQuery.isError) {
    return (
      <EmptyState
        title="Không tìm thấy bài viết"
        description="Bài viết có thể đã bị xóa hoặc bạn không có quyền xem."
        href="/explore"
        action="Về trang khám phá"
      />
    );
  }

  if (!postQuery.data) {
    return (
      <div className="feed-stack">
        <PostSkeleton />
      </div>
    );
  }

  const replies = repliesQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const canReply = isActivePost(postQuery.data);

  return (
    <>
      <ThreadViewUI
        post={postQuery.data}
        ancestors={ancestorsQuery.data ?? []}
        replies={replies}
        repliesLoading={repliesQuery.isPending}
        repliesError={repliesQuery.isError}
        onRetryReplies={() => repliesQuery.refetch()}
        currentUserId={user?.id}
        isLoading={postQuery.isLoading}
        onLike={actions.toggleLike}
        onRepost={actions.toggleRepost}
        onBookmark={actions.toggleBookmark}
        onDelete={actions.deletePost}
        replyComposerNode={
          !canReply ? null : user ? (
            <PostComposer
              parentId={postId}
              placeholder="Viết phản hồi…"
              onSuccess={() =>
                queryClient.invalidateQueries({
                  queryKey: ["posts", "replies", postId],
                })
              }
            />
          ) : (
            <div className="p-4 text-center text-[13px] text-[#8e8ca3]">
              Đăng nhập để tham gia thảo luận.
            </div>
          )
        }
      />
      {ancestorsQuery.isError && (
        <p className="p-4 text-center text-[13px] text-red-600">
          Không thể tải chuỗi bài viết trước đó.
        </p>
      )}
      <InfiniteScrollTrigger
        hasNextPage={Boolean(repliesQuery.hasNextPage)}
        isFetchingNextPage={repliesQuery.isFetchingNextPage}
        isFetchNextPageError={repliesQuery.isFetchNextPageError}
        fetchNextPage={repliesQuery.fetchNextPage}
      />
    </>
  );
}
