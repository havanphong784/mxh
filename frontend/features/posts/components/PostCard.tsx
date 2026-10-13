import React from 'react';
import type { PostItem } from '@/types/api';
import { Avatar } from '@/components/ui/Avatar';
import { PostActionBar } from './PostActionBar';
import { MediaGrid } from './MediaGrid';
import { QuotedPost } from './QuotedPost';
import { TombstoneCard } from './TombstoneCard';
import Link from 'next/link';

interface PostCardProps {
  post: PostItem;
  currentUserId?: string | null;
  onLike?: () => void;
  onReply?: () => void;
  onRepost?: () => void;
  onBookmark?: () => void;
  onDelete?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({
  post,
  currentUserId,
  onLike,
  onReply,
  onRepost,
  onBookmark,
  onDelete,
}) => {
  if (post.isDeleted) {
    return <TombstoneCard />;
  }

  const isOwner = currentUserId && currentUserId === post.author.id;

  return (
    <article className="p-4 border-b border-[#d5d5d5] bg-[#ffffff] hover:bg-[#fafafa]/50 transition-colors">
      <div className="flex space-x-3">
        {/* Cột Avatar tác giả */}
        <Link href={`/${post.author.username}`} className="shrink-0">
          <Avatar src={post.author.avatarUrl} displayName={post.author.displayName} size={36} />
        </Link>

        {/* Cột Nội dung bài viết */}
        <div className="flex-1 min-w-0">
          {/* Header tác giả & ngày giờ */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 truncate">
              <Link
                href={`/${post.author.username}`}
                className="font-semibold text-[13px] text-[#000000] hover:underline truncate"
              >
                {post.author.displayName}
              </Link>
              <span className="text-[13px] text-[#969696] shrink-0">@{post.author.username}</span>
              <span className="text-[13px] text-[#969696] shrink-0">·</span>
              <span className="text-[13px] text-[#969696] shrink-0">
                {new Date(post.createdAt).toLocaleDateString('vi-VN')}
              </span>
            </div>

            {/* Menu hành động (ví dụ xóa bài viết của chính mình) */}
            {isOwner && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="text-[#969696] hover:text-red-500 text-[12px] p-1 cursor-pointer transition-colors"
                title="Xóa bài viết"
              >
                ✕
              </button>
            )}
          </div>

          {/* Nội dung bài viết */}
          <Link href={`/post/${post.id}`}>
            <p className="mt-1 text-[15px] text-[#000000] leading-[1.4] whitespace-pre-wrap break-words">
              {post.content}
            </p>
          </Link>

          {/* Lưới Media đính kèm */}
          {post.media && post.media.length > 0 && <MediaGrid media={post.media} />}

          {/* Bài viết trích dẫn (nếu có) */}
          {post.quotedPost && <QuotedPost post={post.quotedPost} />}

          {/* Thanh tương tác dưới bài viết */}
          <PostActionBar
            counters={post.counters}
            interactions={post.interactions}
            onLike={onLike}
            onReply={onReply}
            onRepost={onRepost}
            onBookmark={onBookmark}
          />
        </div>
      </div>
    </article>
  );
};
