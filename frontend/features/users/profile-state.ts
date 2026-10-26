import type { UserProfile } from '../../types/api.ts';

export function toggleProfileFollow(profile: UserProfile): UserProfile {
  return {
    ...profile,
    isFollowing: !profile.isFollowing,
    followersCount: Math.max(0, profile.followersCount + (profile.isFollowing ? -1 : 1)),
  };
}
