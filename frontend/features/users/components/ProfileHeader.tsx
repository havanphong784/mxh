'use client';

import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import type { UserProfile } from '@/types/api';

export function ProfileHeader({ profile, isOwner, onFollow, onEdit, isFollowPending }: { profile: UserProfile; isOwner: boolean; onFollow: () => void; onEdit: () => void; isFollowPending: boolean }) {
  return <section className="border-b border-[#d5d5d5] bg-white">
    <div className="h-32 bg-[#efefef] bg-cover bg-center sm:h-40" style={profile.bannerUrl ? { backgroundImage: `url(${profile.bannerUrl})` } : undefined} />
    <div className="px-4 pb-4">
      <div className="-mt-10 flex items-end justify-between"><Avatar src={profile.avatarUrl} displayName={profile.displayName} size={80} className="border-4 border-white" />{isOwner ? <Button variant="outlined" onClick={onEdit}>Chỉnh sửa hồ sơ</Button> : <Button variant="outlined" onClick={onFollow} isLoading={isFollowPending}>{profile.isFollowing ? 'Đang theo dõi' : 'Theo dõi'}</Button>}</div>
      <h2 className="mt-3 text-[18px] font-bold">{profile.displayName}</h2><p className="text-[13px] text-[#969696]">@{profile.username}</p>
      {profile.bio && <p className="mt-3 whitespace-pre-wrap text-[15px] leading-5">{profile.bio}</p>}
      <div className="mt-4 flex gap-5 text-[13px]"><Link href={`/${profile.username}/followers`}><b>{profile.followersCount}</b> <span className="text-[#969696]">người theo dõi</span></Link><Link href={`/${profile.username}/following`}><b>{profile.followingCount}</b> <span className="text-[#969696]">đang theo dõi</span></Link></div>
    </div>
  </section>;
}
