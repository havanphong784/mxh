'use client';

import React from 'react';
import type { PostCounters, PostInteractions } from '@/types/api';
import Link from 'next/link';

interface PostActionBarProps {
  counters: PostCounters;
  interactions: PostInteractions;
  onLike?: () => void;
  onReply?: () => void;
  onRepost?: () => void;
  onBookmark?: () => void;
  replyHref?: string;
}

export const PostActionBar: React.FC<PostActionBarProps> = ({
  counters,
  interactions,
  onLike,
  onReply,
  onRepost,
  onBookmark,
  replyHref,
}) => {
  return (
    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#efedf7] pt-4 text-[12px] font-bold text-[#8e8ca3] select-none sm:gap-x-7">
      {/* 1. Nút Thích (Like) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onLike?.();
        }}
        className={`post-action post-action-like group flex items-center gap-1.5 transition-colors ${
          interactions.isLiked ? 'text-[#ed7791]' : 'hover:text-[#ed7791]'
        }`}
        title="Thích"
        aria-label="Thích bài viết"
        aria-pressed={interactions.isLiked}
      >
        <svg
          className="w-5 h-5 transition-transform group-hover:scale-110"
          fill={interactions.isLiked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
        <span className="text-[12px]">{counters.likeCount}</span>
      </button>

      {/* 2. Nút Bình luận (Reply) */}
      {replyHref ? <Link href={replyHref} className="post-action post-action-reply group flex items-center gap-1.5 transition-colors hover:text-[#58a5e9]" title="Bình luận" aria-label="Xem bình luận">
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
        <span className="text-[12px]">{counters.replyCount}</span>
      </Link> : <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onReply?.();
        }}
        className="post-action post-action-reply group flex items-center gap-1.5 transition-colors hover:text-[#58a5e9]"
        title="Bình luận"
        aria-label="Bình luận"
      >
        <svg
          className="w-5 h-5 transition-transform group-hover:scale-110"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
          />
        </svg>
        <span className="text-[12px]">{counters.replyCount}</span>
      </button>}

      {/* 3. Nút Đăng lại (Repost) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRepost?.();
        }}
        className={`post-action post-action-repost group flex items-center gap-1.5 transition-colors ${
          interactions.isReposted ? 'text-[#42b88c]' : 'hover:text-[#42b88c]'
        }`}
        title="Đăng lại"
        aria-label="Đăng lại bài viết"
        aria-pressed={interactions.isReposted}
      >
        <svg
          className="w-5 h-5 transition-transform group-hover:scale-110"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span className="text-[12px]">{counters.repostCount}</span>
      </button>

      {/* 4. Nút Lưu (Bookmark) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onBookmark?.();
        }}
        className={`post-action post-action-bookmark group flex items-center gap-1.5 transition-colors ${
          interactions.isBookmarked ? 'text-[#7773eb]' : 'hover:text-[#7773eb]'
        }`}
        title="Lưu bài viết"
        aria-label="Lưu bài viết"
        aria-pressed={interactions.isBookmarked}
      >
        <svg
          className="w-5 h-5 transition-transform group-hover:scale-110"
          fill={interactions.isBookmarked ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
          />
        </svg>
        <span className="text-[12px]">{counters.bookmarkCount}</span>
      </button>
    </div>
  );
};
