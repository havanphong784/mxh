'use client';

import { useState } from 'react';
import { postsApi } from '../api';
import { isActivePost } from '../post-state';
import { usePostList } from '../hooks/usePostList';
import { InteractivePostCard } from './InteractivePostCard';
import { PostComposer } from './PostComposer';
import type { PostItem } from '@/types/api';

interface ReplyThreadProps {
  reply: PostItem;
  depth: number;
  currentUserId?: string | null;
  onLike: (id: string, isLiked: boolean) => void;
  onRepost?: (id: string, active: boolean) => void;
  onBookmark?: (id: string, active: boolean) => void;
  onDelete?: (id: string) => void;
}

function ReplyChildren({ parentId, depth, currentUserId, onLike, onRepost, onBookmark, onDelete }: Omit<ReplyThreadProps, 'reply'> & { parentId: string }) {
  const query = usePostList(['replies', parentId], (cursor) => postsApi.getReplies(parentId, cursor));
  const replies = query.data?.pages.flatMap((page) => page.items) ?? [];

  if (query.isPending) return <p className="px-4 py-3 text-[12px] text-[#8e8ca3]">Đang tải phản hồi…</p>;
  if (query.isError && replies.length === 0) return <div className="px-4 py-3 text-[12px] text-red-600">Không thể tải phản hồi. <button type="button" onClick={() => query.refetch()} className="font-bold underline">Thử lại</button></div>;

  return <div className="feed-stack">
    {replies.length === 0 && <p className="px-4 py-3 text-[12px] text-[#8e8ca3]">Chưa có phản hồi.</p>}
    {replies.map((reply) => <ReplyThread key={reply.id} reply={reply} depth={depth} currentUserId={currentUserId} onLike={onLike} onRepost={onRepost} onBookmark={onBookmark} onDelete={onDelete} />)}
    {query.hasNextPage && <button type="button" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} className="self-start px-4 py-2 text-[12px] font-bold text-[#6965e8] disabled:opacity-50">{query.isFetchNextPageError ? 'Thử tải lại' : query.isFetchingNextPage ? 'Đang tải…' : 'Xem thêm phản hồi'}</button>}
  </div>;
}

export function ReplyThread({ reply, depth, currentUserId, onLike, onRepost, onBookmark, onDelete }: ReplyThreadProps) {
  const [expanded, setExpanded] = useState(false);
  const [replying, setReplying] = useState(false);
  const replyCount = isActivePost(reply) ? reply.counters.replyCount : reply.replyCount ?? 0;

  return <div className={depth > 0 ? `border-l-2 border-[#eeedff] pl-3 ${depth < 3 ? 'ml-3 sm:ml-6' : ''}` : ''}>
    <InteractivePostCard
      post={reply}
      currentUserId={currentUserId}
      onLike={onLike}
      onRepost={onRepost}
      onBookmark={onBookmark}
      onDelete={onDelete}
      onReply={currentUserId && isActivePost(reply) ? () => setReplying((value) => !value) : undefined}
    />
    {replying && <div className="mt-2"><PostComposer parentId={reply.id} placeholder="Trả lời bình luận…" onSuccess={() => { setReplying(false); setExpanded(true); }} /></div>}
    {replyCount > 0 && <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded} aria-controls={`replies-${reply.id}`} className="px-4 py-3 text-[12px] font-bold text-[#6965e8] hover:underline">{expanded ? 'Ẩn phản hồi' : `Xem ${replyCount} phản hồi`}</button>}
    {expanded && <div id={`replies-${reply.id}`} className="mt-2"><ReplyChildren parentId={reply.id} depth={depth + 1} currentUserId={currentUserId} onLike={onLike} onRepost={onRepost} onBookmark={onBookmark} onDelete={onDelete} /></div>}
  </div>;
}
