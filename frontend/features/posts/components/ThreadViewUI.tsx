'use client';

import React from 'react';
import type { PostItem } from '@/types/api';
import { PostCard } from './PostCard';
import { useRouter } from 'next/navigation';

interface ThreadViewUIProps {
  post: PostItem;
  ancestors: PostItem[];
  replies: PostItem[];
  currentUserId?: string | null;
  isLoading: boolean;
  onLike: (id: string, isLiked: boolean) => void;
  replyComposerNode?: React.ReactNode;
}

export const ThreadViewUI: React.FC<ThreadViewUIProps> = ({
  post,
  ancestors,
  replies,
  currentUserId,
  isLoading,
  onLike,
  replyComposerNode,
}) => {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="p-8 text-center text-[#969696] text-[13px]">
        Đang tải cuộc thảo luận...
      </div>
    );
  }

  return (
    <div className="bg-[#ffffff]">
      {/* 1. Header có nút Quay lại */}
      <div className="h-[48px] px-4 border-b border-[#d5d5d5] flex items-center space-x-4 sticky top-[56px] bg-[#ffffff]/90 backdrop-blur-md z-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-1 rounded-full hover:bg-[#efefef] transition-colors cursor-pointer text-[#000000]"
          title="Quay lại"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h2 className="font-bold text-[15px] text-[#000000]">Thảo luận</h2>
      </div>

      {/* 2. Chuỗi các bài viết cha (Ancestors) nối bằng sợi chỉ dọc */}
      {ancestors.length > 0 && (
        <div className="relative">
          {ancestors.map((ancestor, index) => (
            <div key={ancestor.id} className="relative">
              {/* Sợi chỉ dọc nối các avatar */}
              <div
                className="absolute left-[34px] top-[50px] bottom-0 w-[1.5px] bg-[#d5d5d5] z-0"
                style={{
                  height: 'calc(100% - 10px)',
                }}
              />
              <div className="relative z-1">
                <PostCard
                  post={ancestor}
                  currentUserId={currentUserId}
                  onLike={() => onLike(ancestor.id, ancestor.interactions.isLiked)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. Bài viết chính (Main Post) */}
      <div className="relative border-b-2 border-[#efefef]">
        <PostCard
          post={post}
          currentUserId={currentUserId}
          onLike={() => onLike(post.id, post.interactions.isLiked)}
        />
      </div>

      {/* 4. Khung nhập phản hồi (Reply Composer) */}
      {replyComposerNode && (
        <div className="border-b border-[#d5d5d5] bg-[#fafafa]/50">
          {replyComposerNode}
        </div>
      )}

      {/* 5. Danh sách các bài trả lời (Replies) */}
      <div className="divide-y divide-[#efefef]">
        {replies.length === 0 ? (
          <div className="p-8 text-center text-[#969696] text-[13px]">
            Chưa có phản hồi nào. Hãy là người đầu tiên trả lời!
          </div>
        ) : (
          replies.map((reply) => (
            <PostCard
              key={reply.id}
              post={reply}
              currentUserId={currentUserId}
              onLike={() => onLike(reply.id, reply.interactions.isLiked)}
            />
          ))
        )}
      </div>
    </div>
  );
};
