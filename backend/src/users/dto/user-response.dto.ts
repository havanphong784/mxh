export interface UserSummaryDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio?: string | null;
}

export interface MyProfileResponseDto {
  id: string;
  email: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  avatarPublicId: string | null;
  bannerUrl: string | null;
  bannerPublicId: string | null;
  followersCount: number;
  followingCount: number;
  isEmailVerified: boolean;
  createdAt: string | unknown;
}

export interface PublicProfileResponseDto {
  id: string;
  username: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  bannerUrl: string | null;
  followersCount: number;
  followingCount: number;
  isFollowing: boolean;
  createdAt: string | unknown;
}

export interface FollowActionResultDto {
  message: string;
}

export interface FollowPaginatedResponseDto {
  items: UserSummaryDto[];
  nextCursor: string | null;
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
