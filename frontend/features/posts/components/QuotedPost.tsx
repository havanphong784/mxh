import React from 'react';
import type { QuotedPostItem } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { MediaGrid } from './MediaGrid';

interface QuotedPostProps {
  post: QuotedPostItem;
}

export const QuotedPost: React.FC<QuotedPostProps> = ({ post }) => {
  if (!post.author) {
    return (
      <div className="mt-4 rounded-[18px] bg-[#f4f2fa] p-4 text-[13px] italic text-[#8e8ca3]">
        Bài viết được trích dẫn không còn khả dụng.
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-[18px] bg-[#f4f2fa] p-4 transition-colors hover:bg-[#eeedff]">
      <div className="flex items-center space-x-2">
        <Avatar src={post.author.avatarUrl} displayName={post.author.displayName} size={20} />
        <span className="font-semibold text-[13px] text-[#1c1b29]">{post.author.displayName}</span>
        <span className="text-[12px] text-[#8e8ca3]">@{post.author.username}</span>
      </div>

      {post.content && (
        <p className="mt-1.5 text-[14px] text-[#1c1b29] leading-relaxed line-clamp-3">
          {post.content}
        </p>
      )}

      {post.media && post.media.length > 0 && <MediaGrid media={post.media} />}
    </div>
  );
};
