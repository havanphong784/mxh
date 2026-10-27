'use client';

import React from 'react';
import type { PostItem } from '@/types/api';
import { InteractivePostCard } from './InteractivePostCard';
import { useRouter } from 'next/navigation';

interface ThreadViewUIProps {
  post: PostItem;
  ancestors: PostItem[];
  replies: PostItem[];
  currentUserId?: string | null;
  isLoading: boolean;
  onLike: (id: string, isLiked: boolean) => void;
  onRepost?: (id: string, active: boolean) => void;
  onBookmark?: (id: string, active: boolean) => void;
  onDelete?: (id: string) => void;
  replyComposerNode?: React.ReactNode;
}

export const ThreadViewUI: React.FC<ThreadViewUIProps> = ({
  post,
  ancestors,
  replies,
  currentUserId,
  isLoading,
  onLike,
  onRepost,
  onBookmark,
  onDelete,
  replyComposerNode,
}) => {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[#8e8ca3] text-[13px]">
        Đang tải cuộc thảo luận...
      </div>
    );
  }

  return (
    <div className="feed-stack">
      {/* 1. Header có nút Quay lại */}
      <div className="surface-card flex items-center gap-3 px-5 py-4">
        <button
          type="button"
          onClick={() => router.back()}
          className="grid h-8 w-8 place-items-center rounded-[12px] bg-[#eeedff] text-[#7b78ff] transition-colors hover:bg-[#e4e2ff]"
          title="Quay lại"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h2 className="text-[15px] font-extrabold text-[#1c1b29]">Thảo luận</h2>
      </div>

      {/* 2. Chuỗi các bài viết cha (Ancestors) nối bằng sợi chỉ dọc */}
      {ancestors.length > 0 && (
        <div className="feed-stack relative">
          {ancestors.map((ancestor) => (
            <div key={ancestor.id} className="relative">
              {/* Sợi chỉ dọc nối các avatar */}
              <div className="relative z-1">
                <InteractivePostCard
                  post={ancestor}
                  currentUserId={currentUserId}
                  onLike={onLike}
                  onRepost={onRepost}
                  onBookmark={onBookmark}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Bài viết chính (Main Post) */}
      <div className="relative">
        <InteractivePostCard
          post={post}
          currentUserId={currentUserId}
          onLike={onLike}
          onRepost={onRepost}
          onBookmark={onBookmark}
          onDelete={onDelete}
        />
      </div>

      {/* 4. Khung nhập phản hồi (Reply Composer) */}
      {replyComposerNode && (
        <div>
          {replyComposerNode}
        </div>
      )}

      {/* 5. Danh sách các bài trả lời (Replies) */}
      <div className="feed-stack">
        {replies.length === 0 ? (
          <div className="p-8 text-center text-[#8e8ca3] text-[13px]">
            Chưa có phản hồi nào. Hãy là người đầu tiên trả lời!
          </div>
        ) : (
          replies.map((reply) => (
            <InteractivePostCard
              key={reply.id}
              post={reply}
              currentUserId={currentUserId}
              onLike={onLike}
              onRepost={onRepost}
              onBookmark={onBookmark}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
};
