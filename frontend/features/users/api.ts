import type { AxiosResponse } from "axios";
import { apiClient } from "@/lib/axios";
import type {
  ApiMessageResponse,
  Author,
  CursorPage,
  OffsetPage,
  OwnProfile,
  PostItem,
  UserProfile,
} from "@/types/api";

export type ProfileUpdate = Partial<
  Pick<
    OwnProfile,
    | "displayName"
    | "bio"
    | "avatarUrl"
    | "avatarPublicId"
    | "bannerUrl"
    | "bannerPublicId"
  >
>;

export const usersApi = {
  getProfile: (username: string): Promise<AxiosResponse<UserProfile>> =>
    apiClient.get<UserProfile>(`/users/${username}`),

  search: (
    term: string,
    cursor?: string | null,
  ): Promise<AxiosResponse<CursorPage<Author>>> =>
    apiClient.get<CursorPage<Author>>("/users/search", {
      params: { q: term, cursor, limit: 20 },
    }),

  suggestions: (): Promise<AxiosResponse<{ items: Author[] }>> =>
    apiClient.get<{ items: Author[] }>("/users/suggestions"),

  getMe: (): Promise<AxiosResponse<OwnProfile>> =>
    apiClient.get<OwnProfile>("/users/me"),

  updateMe: (data: ProfileUpdate): Promise<AxiosResponse<OwnProfile>> =>
    apiClient.patch<OwnProfile>("/users/me", data),

  changePassword: (data: {
    oldPassword: string;
    newPassword: string;
    logoutOtherDevices: boolean;
  }): Promise<AxiosResponse<ApiMessageResponse>> =>
    apiClient.post<ApiMessageResponse>("/users/change-password", data),

  follow: (id: string): Promise<AxiosResponse<ApiMessageResponse>> =>
    apiClient.post<ApiMessageResponse>(`/users/${id}/follow`),

  unfollow: (id: string): Promise<AxiosResponse<ApiMessageResponse>> =>
    apiClient.delete<ApiMessageResponse>(`/users/${id}/follow`),

  getFollowers: (
    username: string,
    page = 1,
  ): Promise<AxiosResponse<OffsetPage<Author>>> =>
    apiClient.get<OffsetPage<Author>>(`/users/${username}/followers`, {
      params: { page, limit: 20 },
    }),

  getFollowing: (
    username: string,
    page = 1,
  ): Promise<AxiosResponse<OffsetPage<Author>>> =>
    apiClient.get<OffsetPage<Author>>(`/users/${username}/following`, {
      params: { page, limit: 20 },
    }),

  getPosts: (
    username: string,
    cursor?: string | null,
  ): Promise<AxiosResponse<CursorPage<PostItem>>> =>
    apiClient.get<CursorPage<PostItem>>(`/users/${username}/posts`, {
      params: { cursor, limit: 20 },
    }),

  getReplies: (
    username: string,
    cursor?: string | null,
  ): Promise<AxiosResponse<CursorPage<PostItem>>> =>
    apiClient.get<CursorPage<PostItem>>(`/users/${username}/replies`, {
      params: { cursor, limit: 20 },
    }),
};
