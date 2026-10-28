"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "../api";
import { toggleProfileFollow } from "../profile-state";
import type { UserProfile } from "@/types/api";

export function useProfile(username: string) {
  const queryClient = useQueryClient();
  const queryKey = ["users", "profile", username] as const;
  const query = useQuery({
    queryKey,
    queryFn: async () => (await usersApi.getProfile(username)).data,
    enabled: Boolean(username),
  });
  const followMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? usersApi.unfollow(id) : usersApi.follow(id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<UserProfile>(queryKey);
      queryClient.setQueryData<UserProfile>(queryKey, (old) =>
        old ? toggleProfileFollow(old) : old,
      );
      return { previous };
    },
    onError: (_error, _variables, context) =>
      queryClient.setQueryData(queryKey, context?.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
  return {
    ...query,
    toggleFollow: () =>
      query.data &&
      followMutation.mutate({
        id: query.data.id,
        active: query.data.isFollowing,
      }),
    isFollowPending: followMutation.isPending,
  };
}
