"use client";

import { useState } from "react";
import type { PostItem } from "@/types/api";
import { isActivePost } from "../post-state";
import { PostCard } from "./PostCard";
import { EditPostModal } from "./EditPostModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

interface InteractivePostCardProps {
  post: PostItem;
  currentUserId?: string | null;
  onLike?: (id: string, active: boolean) => void;
  onRepost?: (id: string, active: boolean) => void;
  onBookmark?: (id: string, active: boolean) => void;
  onDelete?: (id: string) => void;
  onReply?: () => void;
}

export function InteractivePostCard({
  post,
  currentUserId,
  onLike,
  onRepost,
  onBookmark,
  onDelete,
  onReply,
}: InteractivePostCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  const actions = isActivePost(post)
    ? {
        onLike: () => onLike?.(post.id, post.interactions.isLiked),
        onRepost: () => onRepost?.(post.id, post.interactions.isReposted),
        onBookmark: () => onBookmark?.(post.id, post.interactions.isBookmarked),
        onDelete: () => setIsConfirmDeleteOpen(true),
        onEdit: () => setIsEditing(true),
        onReply,
      }
    : {};

  return (
    <>
      <PostCard post={post} currentUserId={currentUserId} {...actions} />
      {isEditing && isActivePost(post) && (
        <EditPostModal post={post} onClose={() => setIsEditing(false)} />
      )}
      <ConfirmModal
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        onConfirm={() => {
          onDelete?.(post.id);
          setIsConfirmDeleteOpen(false);
        }}
        title="Xóa bài viết"
        message="Bạn có chắc chắn muốn xóa bài viết này không? Hành động này không thể hoàn tác."
        confirmLabel="Xóa bài"
        cancelLabel="Hủy"
        isDestructive={true}
      />
    </>
  );
}
