'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProfile } from '@/features/users/hooks/useProfile';
import { usersApi } from '@/features/users/api';
import { ProfileHeader } from '@/features/users/components/ProfileHeader';
import { EditProfileModal } from '@/features/users/components/EditProfileModal';
import { usePostList } from '@/features/posts/hooks/usePostList';
import { usePostInteractions } from '@/features/posts/hooks/usePostInteractions';
import { InteractivePostCard } from '@/features/posts/components/InteractivePostCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';

export default function ProfilePage() {
  const username = useParams<{ username: string }>().username;
  const router = useRouter();
  const currentUser = useAuthStore((state) => state.user);
  const [tab, setTab] = useState<'posts' | 'replies'>('posts');
  const [editing, setEditing] = useState(false);
  const profile = useProfile(username);
  const list = usePostList(['user', username, tab], (cursor) => tab === 'posts' ? usersApi.getPosts(username, cursor) : usersApi.getReplies(username, cursor));
  const actions = usePostInteractions();

  if (profile.isError) return <EmptyState title="Không tìm thấy người dùng" description="Tài khoản này không tồn tại hoặc không còn hoạt động." href="/explore" action="Khám phá cộng đồng" />;
  if (!profile.data) return <p className="p-8 text-center text-[13px] text-[#969696]">Đang tải hồ sơ…</p>;
  const isOwner = currentUser?.id === profile.data.id;
  const posts = list.data?.pages.flatMap((page) => page.items) ?? [];

  return <div><ProfileHeader profile={profile.data} isOwner={isOwner} onEdit={() => setEditing(true)} onFollow={() => currentUser ? profile.toggleFollow() : router.push('/login')} isFollowPending={profile.isFollowPending} /><div className="grid grid-cols-2 border-b border-[#d5d5d5]">{(['posts', 'replies'] as const).map((item) => <button key={item} onClick={() => setTab(item)} className={`py-3 text-[13px] font-semibold ${tab === item ? 'border-b-2 border-black text-black' : 'text-[#969696]'}`}>{item === 'posts' ? 'Bài viết' : 'Phản hồi'}</button>)}</div>{list.isLoading ? <p className="p-8 text-center text-[13px] text-[#969696]">Đang tải…</p> : list.isError ? <EmptyState title="Không thể tải nội dung" description="Đã có lỗi kết nối. Vui lòng tải lại trang." /> : posts.length === 0 ? <EmptyState title={tab === 'posts' ? 'Chưa có bài viết' : 'Chưa có phản hồi'} description="Nội dung mới sẽ xuất hiện ở đây." /> : <>{posts.map((post) => <InteractivePostCard key={post.id} post={post} currentUserId={currentUser?.id} onLike={actions.toggleLike} onRepost={actions.toggleRepost} onBookmark={actions.toggleBookmark} onDelete={actions.deletePost} />)}{list.hasNextPage && <div className="p-4 text-center"><Button variant="ghost" onClick={() => list.fetchNextPage()} isLoading={list.isFetchingNextPage}>Xem thêm</Button></div>}</>}{isOwner && <EditProfileModal profile={profile.data} isOpen={editing} onClose={() => setEditing(false)} />}</div>;
}
