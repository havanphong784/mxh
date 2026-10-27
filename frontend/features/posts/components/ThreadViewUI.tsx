'use client';

import React from 'react';
import type { PostItem } from '@/types/api';
import { InteractivePostCard } from './InteractivePostCard';
import { ReplyThread } from './ReplyThread';

interface ThreadViewUIProps {
  post: PostItem;
  ancestors: PostItem[];
  replies: PostItem[];
  repliesLoading?: boolean;
  repliesError?: boolean;
  onRetryReplies?: () => void;
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
  repliesLoading,
  repliesError,
  onRetryReplies,
  currentUserId,
  isLoading,
  onLike,
  onRepost,
  onBookmark,
  onDelete,
  replyComposerNode,
}) => {

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[#8e8ca3] text-[13px]">
        Đang tải cuộc thảo luận...
      </div>
    );
  }

  return (
    <div className="feed-stack">
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
        {repliesLoading ? (
          <div className="p-8 text-center text-[#8e8ca3] text-[13px]">Đang tải phản hồi…</div>
        ) : repliesError && replies.length === 0 ? (
          <div className="p-8 text-center text-red-600 text-[13px]">Không thể tải phản hồi. <button type="button" onClick={onRetryReplies} className="font-bold underline">Thử lại</button></div>
        ) : replies.length === 0 ? (
          <div className="p-8 text-center text-[#8e8ca3] text-[13px]">
            Chưa có phản hồi nào. Hãy là người đầu tiên trả lời!
          </div>
        ) : (
          replies.map((reply) => (
            <ReplyThread
              key={reply.id}
              reply={reply}
              depth={0}
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
