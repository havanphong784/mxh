import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { postsApi } from '../api';
import type { PostItem } from '@/types/api';

export function useFeed() {
  const queryClient = useQueryClient();

  // 1. Phân trang vô tận qua Keyset Cursor
  const query = useInfiniteQuery({
    queryKey: ['feed'],
    queryFn: async ({ pageParam = null }) => {
      const res = await postsApi.getFeed(pageParam);
      return res.data;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
  });

  // 2. Optimistic Like Mutation
  const likeMutation = useMutation({
    mutationFn: ({ id, isLiked }: { id: string; isLiked: boolean }) =>
      isLiked ? postsApi.unlikePost(id) : postsApi.likePost(id),
    onMutate: async ({ id, isLiked }) => {
      await queryClient.cancelQueries({ queryKey: ['feed'] });
      const previousData = queryClient.getQueryData(['feed']);

      // Cập nhật tức thì giao diện trong cache
      queryClient.setQueryData(['feed'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            data: page.data.map((p: PostItem) =>
              p.id === id
                ? {
                    ...p,
                    interactions: { ...p.interactions, isLiked: !isLiked },
                    counters: {
                      ...p.counters,
                      likeCount: isLiked ? p.counters.likeCount - 1 : p.counters.likeCount + 1,
                    },
                  }
                : p
            ),
          })),
        };
      });

      return { previousData };
    },
    onError: (_, __, context: any) => {
      if (context?.previousData) {
        queryClient.setQueryData(['feed'], context.previousData);
      }
    },
  });

  return {
    ...query,
    toggleLike: (id: string, isLiked: boolean) => likeMutation.mutate({ id, isLiked }),
  };
}
