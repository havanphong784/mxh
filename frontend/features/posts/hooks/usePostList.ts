'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import type { CursorPage, PostItem } from '@/types/api';

export function usePostList(key: readonly unknown[], fetcher: (cursor?: string | null) => Promise<{ data: CursorPage<PostItem> }>, enabled = true) {
  return useInfiniteQuery({
    queryKey: ['posts', ...key],
    queryFn: async ({ pageParam }) => (await fetcher(pageParam)).data,
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled,
  });
}
