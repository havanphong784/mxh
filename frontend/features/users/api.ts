import { apiClient } from '@/lib/axios';
import type { ApiMessageResponse, Author, CursorPage, OffsetPage, OwnProfile, PostItem, UserProfile } from '@/types/api';

export type ProfileUpdate = Partial<Pick<OwnProfile, 'displayName' | 'bio' | 'avatarUrl' | 'avatarPublicId' | 'bannerUrl' | 'bannerPublicId'>>;

export const usersApi = {
  getProfile: (username: string) => apiClient.get<UserProfile>(`/users/${username}`),
  getMe: () => apiClient.get<OwnProfile>('/users/me'),
  updateMe: (data: ProfileUpdate) => apiClient.patch<OwnProfile>('/users/me', data),
  follow: (id: string) => apiClient.post<ApiMessageResponse>(`/users/${id}/follow`),
  unfollow: (id: string) => apiClient.delete<ApiMessageResponse>(`/users/${id}/follow`),
  getFollowers: (username: string, page = 1) => apiClient.get<OffsetPage<Author>>(`/users/${username}/followers`, { params: { page, limit: 20 } }),
  getFollowing: (username: string, page = 1) => apiClient.get<OffsetPage<Author>>(`/users/${username}/following`, { params: { page, limit: 20 } }),
  getPosts: (username: string, cursor?: string | null) => apiClient.get<CursorPage<PostItem>>(`/users/${username}/posts`, { params: { cursor, limit: 20 } }),
  getReplies: (username: string, cursor?: string | null) => apiClient.get<CursorPage<PostItem>>(`/users/${username}/replies`, { params: { cursor, limit: 20 } }),
};
