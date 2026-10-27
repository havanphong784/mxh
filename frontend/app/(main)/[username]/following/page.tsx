'use client';

import { useParams } from 'next/navigation';
import { useInfiniteQuery } from '@tanstack/react-query';
import { usersApi } from '@/features/users/api';
import { UserList } from '@/features/users/components/UserList';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';

export default function FollowingPage() {
  const username = useParams<{ username: string }>().username;
  const query = useInfiniteQuery({
    queryKey: ['profile', username, 'following'],
    queryFn: async ({ pageParam }) => (await usersApi.getFollowing(username, pageParam)).data,
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.meta.page < lastPage.meta.totalPages ? lastPage.meta.page + 1 : undefined,
  });
  if (query.isLoading) return <p className="p-8 text-center text-[13px] text-[#8e8ca3]">Đang tải danh sách…</p>;
  if (query.isError) return <EmptyState title="Không thể tải danh sách" description="Vui lòng kiểm tra kết nối và thử lại." />;
  const users = query.data?.pages.flatMap((page) => page.items) ?? [];
  return <><UserList users={users} emptyText="Chưa theo dõi ai" />{query.hasNextPage && <div className="p-4 text-center"><Button variant="ghost" onClick={() => query.fetchNextPage()} isLoading={query.isFetchingNextPage}>Xem thêm</Button></div>}</>;
}
