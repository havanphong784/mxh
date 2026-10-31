"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { usersApi } from "@/features/users/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfiniteScrollTrigger } from "./InfiniteScrollTrigger";
import { UserList } from "./UserList";

export function UserConnectionPage({
  username,
  kind,
}: {
  username: string;
  kind: "followers" | "following";
}) {
  const query = useInfiniteQuery({
    queryKey: ["users", "profile", username, kind],
    queryFn: async ({ pageParam }) =>
      (
        await (kind === "followers"
          ? usersApi.getFollowers(username, pageParam)
          : usersApi.getFollowing(username, pageParam))
      ).data,
    initialPageParam: 1,
    getNextPageParam: (page) =>
      page.meta.page < page.meta.totalPages ? page.meta.page + 1 : undefined,
  });
  const users = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isPending)
    return (
      <p className="p-8 text-center text-[13px] text-[#8e8ca3]">
        Đang tải danh sách…
      </p>
    );
  if (query.isError && users.length === 0 && !query.isFetchNextPageError)
    return (
      <EmptyState
        title="Không thể tải danh sách"
        description="Vui lòng kiểm tra kết nối và thử lại."
      />
    );

  return (
    <div className="feed-stack">
      {(users.length > 0 || !query.hasNextPage) && (
        <UserList
          users={users}
          emptyText={
            kind === "followers" ? "Chưa có người theo dõi" : "Chưa theo dõi ai"
          }
        />
      )}
      <InfiniteScrollTrigger
        hasNextPage={Boolean(query.hasNextPage)}
        isFetchingNextPage={query.isFetchingNextPage}
        isFetchNextPageError={query.isFetchNextPageError}
        fetchNextPage={query.fetchNextPage}
      />
    </div>
  );
}
