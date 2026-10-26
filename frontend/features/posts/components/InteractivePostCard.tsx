'use client';

import type { PostItem } from '@/types/api';
import { isActivePost } from '../post-state';
import { PostCard } from './PostCard';

interface InteractivePostCardProps {
  post: PostItem;
  currentUserId?: string | null;
  onLike?: (id: string, active: boolean) => void;
  onRepost?: (id: string, active: boolean) => void;
  onBookmark?: (id: string, active: boolean) => void;
  onDelete?: (id: string) => void;
}

export function InteractivePostCard({ post, currentUserId, onLike, onRepost, onBookmark, onDelete }: InteractivePostCardProps) {
  const actions = isActivePost(post) ? {
    onLike: () => onLike?.(post.id, post.interactions.isLiked),
    onRepost: () => onRepost?.(post.id, post.interactions.isReposted),
    onBookmark: () => onBookmark?.(post.id, post.interactions.isBookmarked),
    onDelete: () => onDelete?.(post.id),
  } : {};

  return <PostCard post={post} currentUserId={currentUserId} {...actions} />;
}
