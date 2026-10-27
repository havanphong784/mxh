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

  if (post.isUnavailable) {
    return <TombstoneCard message="Bài viết này không còn khả dụng." />;
  }

  const isOwner = currentUserId && currentUserId === post.author.id;

  return (
    <article className="feed-card p-5 transition-shadow sm:p-6">
      <div className="flex gap-3 sm:gap-4">
        {/* Cột Avatar tác giả */}
        <Link href={`/${post.author.username}`} className="shrink-0">
          <Avatar src={post.author.avatarUrl} displayName={post.author.displayName} size={44} />
        </Link>

        {/* Cột Nội dung bài viết */}
        <div className="flex-1 min-w-0">
          {/* Header tác giả & ngày giờ */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link
                href={`/${post.author.username}`}
                className="block truncate text-[14px] font-extrabold text-[#1c1b29] hover:text-[#7b78ff]"
              >
                {post.author.displayName}
              </Link>
              <p className="mt-0.5 truncate text-[11px] font-semibold text-[#8e8ca3]">@{post.author.username}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <time className="text-[11px] font-semibold text-[#8e8ca3]" dateTime={post.createdAt}>{new Date(post.createdAt).toLocaleDateString('vi-VN')}</time>
            {isOwner && onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="grid h-6 w-6 place-items-center rounded-full text-[11px] text-[#8e8ca3] transition-colors hover:bg-[#fff0f3] hover:text-[#e86480]"
                title="Xóa bài viết"
                aria-label="Xóa bài viết"
              >
                ✕
              </button>
            )}
            </div>
          </div>

          {post.visibility !== 'PUBLIC' && <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${post.visibility === 'FOLLOWERS' ? 'bg-[#e8f5ff] text-[#438dc4]' : 'bg-[#eeedff] text-[#6864dc]'}`}>{post.visibility === 'FOLLOWERS' ? 'Người theo dõi' : 'Riêng tư'}</span>}

          {/* Nội dung bài viết */}
          <Link href={`/post/${post.id}`}>
            <p className="mt-3 whitespace-pre-wrap break-words text-[14px] leading-[1.65] text-[#4a4860]">
              {post.content}
            </p>
          </Link>

          {/* Lưới Media đính kèm */}
          {post.media && post.media.length > 0 && <MediaGrid media={post.media} />}

          {/* Bài viết trích dẫn (nếu có) */}
          {post.quotedPost ? <QuotedPost post={post.quotedPost} /> : post.isQuotedPostDeleted ? <div className="mt-3 rounded-[18px] bg-[#f4f2fa] p-3 text-[13px] italic text-[#8e8ca3]">Bài viết được trích dẫn không còn khả dụng.</div> : null}

          {/* Thanh tương tác dưới bài viết */}
          <PostActionBar
            counters={post.counters}
            interactions={post.interactions}
            onLike={onLike}
            onReply={onReply}
            onRepost={onRepost}
            onBookmark={onBookmark}
            replyHref={`/post/${post.id}`}
          />
        </div>
      </div>
    </article>
  );
};
