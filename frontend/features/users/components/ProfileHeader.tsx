'use client';

import Link from 'next/link';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import type { UserProfile } from '@/types/api';

export function ProfileHeader({ profile, isOwner, onFollow, onEdit, isFollowPending }: { profile: UserProfile; isOwner: boolean; onFollow: () => void; onEdit: () => void; isFollowPending: boolean }) {
  return <section className="surface-card overflow-hidden">
    <div className="h-32 bg-[linear-gradient(135deg,#b9b4ff,#f5c9dc_58%,#afe4ff)] bg-cover bg-center sm:h-40" style={profile.bannerUrl ? { backgroundImage: `url(${profile.bannerUrl})` } : undefined} />
    <div className="px-5 pb-6 sm:px-6">
      <div className="-mt-10 flex flex-wrap items-end justify-between gap-3"><Avatar src={profile.avatarUrl} displayName={profile.displayName} size={80} className="border-4 border-white" />{isOwner ? <div className="flex flex-wrap gap-2"><Button variant="outlined" onClick={onEdit}>Chỉnh sửa hồ sơ</Button><Link href="/settings/security" className="inline-flex items-center rounded-full bg-[#f4f2fa] px-4 text-[12px] font-bold text-[#6965e8]">Bảo mật</Link></div> : <Button variant="outlined" onClick={onFollow} isLoading={isFollowPending}>{profile.isFollowing ? 'Đang theo dõi' : 'Theo dõi'}</Button>}</div>
      <h2 className="mt-3 text-[20px] font-extrabold text-[#1c1b29]">{profile.displayName}</h2><p className="text-[12px] font-semibold text-[#8e8ca3]">@{profile.username}</p>
      {profile.bio && <p className="mt-4 whitespace-pre-wrap text-[14px] leading-6 text-[#4a4860]">{profile.bio}</p>}
      <div className="mt-5 flex flex-wrap gap-3 text-[12px]"><Link href={`/${profile.username}/followers`} className="rounded-full bg-[#f4f2fa] px-3 py-2"><b className="text-[#1c1b29]">{profile.followersCount}</b> <span className="text-[#6d6a82]">người theo dõi</span></Link><Link href={`/${profile.username}/following`} className="rounded-full bg-[#f4f2fa] px-3 py-2"><b className="text-[#1c1b29]">{profile.followingCount}</b> <span className="text-[#6d6a82]">đang theo dõi</span></Link></div>
    </div>
  </section>;
}
