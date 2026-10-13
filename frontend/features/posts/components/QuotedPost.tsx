import React from 'react';
import type { PostItem } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { MediaGrid } from './MediaGrid';
import Link from 'next/link';

interface QuotedPostProps {
  post: PostItem;
}

export const QuotedPost: React.FC<QuotedPostProps> = ({ post }) => {
  if (post.isDeleted) {
    return (
      <div className="mt-3 p-3 rounded-[12px] border border-[#d5d5d5] bg-[#fafafa] text-[#969696] text-[13px] italic">
        Bài viết được trích dẫn đã bị xóa.
      </div>
    );
  }

  return (
    <div className="mt-3 p-3.5 rounded-[12px] border border-[#d5d5d5] bg-[#ffffff] hover:bg-[#fafafa]/60 transition-colors">
      <div className="flex items-center space-x-2">
        <Avatar src={post.author.avatarUrl} displayName={post.author.displayName} size={20} />
        <span className="font-semibold text-[13px] text-[#000000]">{post.author.displayName}</span>
        <span className="text-[12px] text-[#969696]">@{post.author.username}</span>
      </div>

      {post.content && (
        <p className="mt-1.5 text-[14px] text-[#000000] leading-relaxed line-clamp-3">
          {post.content}
        </p>
      )}

      {post.media && post.media.length > 0 && <MediaGrid media={post.media} />}
    </div>
  );
};
