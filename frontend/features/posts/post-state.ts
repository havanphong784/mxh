import type { ActivePostItem, PostItem } from '../../types/api.ts';

export type PostInteractionKind = 'like' | 'repost' | 'bookmark';

const fields = {
  like: ['isLiked', 'likeCount'],
  repost: ['isReposted', 'repostCount'],
  bookmark: ['isBookmarked', 'bookmarkCount'],
} as const;

export function isActivePost(post: PostItem): post is ActivePostItem {
  return post.isDeleted !== true && post.isUnavailable !== true;
}

export function togglePostInteraction(post: ActivePostItem, kind: PostInteractionKind): ActivePostItem {
  const [interactionKey, counterKey] = fields[kind];
  const active = post.interactions[interactionKey];
  return {
    ...post,
    interactions: { ...post.interactions, [interactionKey]: !active },
    counters: {
      ...post.counters,
      [counterKey]: Math.max(0, post.counters[counterKey] + (active ? -1 : 1)),
    },
  };
}

export function updatePostTree(value: unknown, postId: string, kind: PostInteractionKind): unknown {
  if (Array.isArray(value)) return value.map((item) => updatePostTree(item, postId, kind));
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (record.id === postId && record.interactions && record.counters) {
    return togglePostInteraction(record as unknown as ActivePostItem, kind);
  }
  return Object.fromEntries(Object.entries(record).map(([key, child]) => [key, updatePostTree(child, postId, kind)]));
}
