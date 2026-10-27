'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { postsApi } from '@/features/posts/api';
import { usersApi } from '@/features/users/api';
import { usePostList } from '@/features/posts/hooks/usePostList';
import { usePostInteractions } from '@/features/posts/hooks/usePostInteractions';
import { InteractivePostCard } from '@/features/posts/components/InteractivePostCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/Avatar';
import { useAuthStore } from '@/stores/authStore';
import { getApiErrorMessage } from '@/lib/api-error';
import type { Author } from '@/types/api';

export default function ExplorePage() {
  const userId = useAuthStore((state) => state.user?.id);
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [tab, setTab] = useState<'posts' | 'users'>('posts');
  const [mediaOnly, setMediaOnly] = useState(false);
  const [followPending, setFollowPending] = useState<string | null>(null);
  const [followError, setFollowError] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const actions = usePostInteractions();

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(input.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [input]);

  const browse = usePostList(['explore', mediaOnly], (cursor) => postsApi.getExplore(cursor, mediaOnly), tab === 'posts' && term.length === 0);
  const searchPosts = usePostList(['search', term, mediaOnly], (cursor) => postsApi.searchPosts(term, cursor, mediaOnly), tab === 'posts' && term.length >= 2);
  const query = term ? searchPosts : browse;
  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = query;
  const searchUsers = useQuery({ queryKey: ['users', 'search', term], queryFn: async () => (await usersApi.search(term)).data.items, enabled: tab === 'users' && term.length >= 2 });
  const suggestions = useQuery({ queryKey: ['users', 'suggestions', userId], queryFn: async () => (await usersApi.suggestions()).data.items, enabled: tab === 'users' && term.length === 0 });

  useEffect(() => {
    if (tab !== 'posts' || !hasNextPage || isFetchingNextPage || isFetchNextPageError || !sentinelRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }, { rootMargin: '300px 0px', threshold: 0 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [tab, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage]);

  const follow = async (person: Author) => {
    if (!userId) return;
    setFollowPending(person.id);
    setFollowError(null);
    try {
      await usersApi.follow(person.id);
      await queryClient.invalidateQueries({ queryKey: ['users', 'suggestions'] });
      await queryClient.invalidateQueries({ queryKey: ['profile', person.username] });
    } catch (error) {
      setFollowError(getApiErrorMessage(error, 'Không thể theo dõi tài khoản này.'));
    } finally {
      setFollowPending(null);
    }
  };

  const posts = query.data?.pages.flatMap((page) => page.items) ?? [];
  const people = term ? searchUsers.data : suggestions.data;
  const peoplePending = term ? searchUsers.isPending : suggestions.isPending;
  const peopleError = term ? searchUsers.isError : suggestions.isError;

  return <div className="feed-stack">
    <section className="surface-card p-4 sm:p-5">
      <label htmlFor="explore-search" className="block text-[13px] font-bold text-[#4a4860]">Tìm trong cộng đồng</label>
      <input id="explore-search" type="search" value={input} onChange={(event) => setInput(event.target.value)} placeholder="Tìm bài viết hoặc người dùng…" className="mt-3 w-full rounded-[16px] border border-[#efedf7] bg-[#f4f2fa] px-4 py-3 text-[14px] outline-none focus:border-[#7b78ff]" />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div aria-label="Loại kết quả" className="flex gap-2">
          <button aria-pressed={tab === 'posts'} onClick={() => setTab('posts')} className={`rounded-full px-4 py-2 text-[12px] font-bold ${tab === 'posts' ? 'bg-[#eeedff] text-[#6965e8]' : 'text-[#6d6a82]'}`}>Bài viết</button>
          <button aria-pressed={tab === 'users'} onClick={() => setTab('users')} className={`rounded-full px-4 py-2 text-[12px] font-bold ${tab === 'users' ? 'bg-[#eeedff] text-[#6965e8]' : 'text-[#6d6a82]'}`}>Người dùng</button>
        </div>
        {tab === 'posts' && <label className="flex items-center gap-2 text-[12px] font-semibold text-[#6d6a82]"><input type="checkbox" checked={mediaOnly} onChange={(event) => setMediaOnly(event.target.checked)} />Chỉ bài có ảnh hoặc video</label>}
      </div>
    </section>

    {term.length === 1 ? <EmptyState title="Nhập thêm một ký tự" description="Từ khóa tìm kiếm cần ít nhất 2 ký tự." /> : tab === 'users' ? <>
      {!term && <h2 className="px-2 text-[16px] font-extrabold">Gợi ý theo dõi</h2>}
      {peoplePending ? <p className="p-6 text-center text-[13px] text-[#8e8ca3]">Đang tải người dùng…</p> : peopleError ? <EmptyState title="Không thể tải người dùng" description="Vui lòng thử lại." /> : !people?.length ? <EmptyState title="Không tìm thấy người dùng" description="Hãy thử một từ khóa khác." /> : people.map((person) => <div key={person.id} className="soft-list-row flex items-center gap-3 p-4">
        <Link href={`/${person.username}`}><Avatar src={person.avatarUrl} displayName={person.displayName} size={44} /></Link>
        <div className="min-w-0 flex-1"><Link href={`/${person.username}`} className="block truncate text-[13px] font-extrabold text-[#1c1b29]">{person.displayName}</Link><p className="truncate text-[11px] text-[#8e8ca3]">@{person.username}</p>{person.bio && <p className="mt-1 line-clamp-2 text-[12px] text-[#6d6a82]">{person.bio}</p>}</div>
        {!term && userId && person.id !== userId ? <button onClick={() => follow(person)} disabled={followPending === person.id} className="rounded-full bg-[#eeedff] px-3 py-2 text-[12px] font-bold text-[#6965e8] disabled:opacity-50">Theo dõi</button> : <Link href={`/${person.username}`} className="text-[12px] font-bold text-[#6965e8]">Hồ sơ</Link>}
      </div>)}
      {followError && <p role="alert" className="px-2 text-[13px] text-red-600">{followError}</p>}
    </> : query.isPending ? <p className="p-8 text-center text-[13px] text-[#8e8ca3]">Đang tải bài viết…</p> : query.isError && posts.length === 0 ? <EmptyState title="Không thể tải khám phá" description="Đã có lỗi kết nối. Vui lòng thử lại." /> : posts.length === 0 ? <EmptyState title={term ? 'Không tìm thấy bài viết' : 'Chưa có bài viết công khai'} description={term ? 'Thử một từ khóa khác hoặc bỏ bộ lọc media.' : 'Những bài viết mới từ cộng đồng sẽ xuất hiện tại đây.'} /> : <>
      {posts.map((post) => <InteractivePostCard key={post.id} post={post} currentUserId={userId} onLike={actions.toggleLike} onRepost={actions.toggleRepost} onBookmark={actions.toggleBookmark} onDelete={actions.deletePost} />)}
      <div ref={sentinelRef} className="py-5 text-center text-[12px] text-[#8e8ca3]" aria-live="polite">{query.isFetchingNextPage ? 'Đang tải thêm bài viết…' : query.hasNextPage ? '' : 'Bạn đã xem hết bài viết.'}</div>
      {query.isFetchNextPageError && <button onClick={() => query.fetchNextPage()} className="mx-auto rounded-full bg-[#eeedff] px-4 py-2 text-[12px] font-bold text-[#6965e8]">Thử tải lại</button>}
    </>}
  </div>;
}
