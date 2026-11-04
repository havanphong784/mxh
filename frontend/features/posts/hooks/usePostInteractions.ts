"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postsApi } from "../api";
import {
  restorePostInteraction,
  updatePostTree,
  type PostInteractionKind,
} from "../post-state";
import { queuePostInteraction } from "../interaction-queue";

type Variables = { id: string; kind: PostInteractionKind; active: boolean };

export function usePostInteractions() {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: ({ id, kind, active }: Variables) =>
      queuePostInteraction(`${id}:${kind}`, () => {
        if (kind === "like")
          return active ? postsApi.unlikePost(id) : postsApi.likePost(id);
        if (kind === "repost")
          return active ? postsApi.unrepost(id) : postsApi.repost(id);
        return active ? postsApi.unbookmark(id) : postsApi.bookmark(id);
      }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["posts"] });
      queryClient.setQueriesData({ queryKey: ["posts"] }, (old) =>
        updatePostTree(old, variables.id, variables.kind),
      );
    },
    onError: (_error, variables) => {
      queryClient.setQueriesData({ queryKey: ["posts"] }, (old) =>
        restorePostInteraction(
          old,
          variables.id,
          variables.kind,
          variables.active,
        ),
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });
  const deleteMutation = useMutation({
    mutationFn: postsApi.deletePost,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
  });
  return {
    toggleLike: (id: string, active: boolean) =>
      mutation.mutate({ id, kind: "like", active }),
    toggleRepost: (id: string, active: boolean) =>
      mutation.mutate({ id, kind: "repost", active }),
    toggleBookmark: (id: string, active: boolean) =>
      mutation.mutate({ id, kind: "bookmark", active }),
    deletePost: (id: string) => deleteMutation.mutate(id),
  };
}
