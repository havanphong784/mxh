import type { AxiosResponse } from "axios";
import { apiClient } from "@/lib/axios";
import type { CursorPage, PostItem, PostMediaInput } from "@/types/api";

export const postsApi = {
  getFeed: (
    cursor?: string | null,
  ): Promise<AxiosResponse<CursorPage<PostItem>>> =>
    apiClient.get<CursorPage<PostItem>>("/posts/feed", {
      params: { limit: 20, cursor },
    }),

  getExplore: (
    cursor?: string | null,
    mediaOnly = false,
  ): Promise<AxiosResponse<CursorPage<PostItem>>> =>
    apiClient.get<CursorPage<PostItem>>("/posts/explore", {
      params: { limit: 20, cursor, mediaOnly },
    }),

  searchPosts: (
    term: string,
    cursor?: string | null,
    mediaOnly = false,
  ): Promise<AxiosResponse<CursorPage<PostItem>>> =>
    apiClient.get<CursorPage<PostItem>>("/posts/search", {
      params: { q: term, limit: 20, cursor, mediaOnly },
    }),

  getPost: (id: string): Promise<AxiosResponse<PostItem>> =>
    apiClient.get<PostItem>(`/posts/${id}`),

  getAncestors: (
    id: string,
  ): Promise<AxiosResponse<{ ancestors: PostItem[] }>> =>
    apiClient.get<{ ancestors: PostItem[] }>(`/posts/${id}/ancestors`),

  getReplies: (
    id: string,
    cursor?: string | null,
  ): Promise<AxiosResponse<CursorPage<PostItem>>> =>
    apiClient.get<CursorPage<PostItem>>(`/posts/${id}/replies`, {
      params: { limit: 20, cursor },
    }),

  createPost: (data: {
    content?: string | null;
    visibility?: "PUBLIC" | "FOLLOWERS" | "PRIVATE";
    media?: PostMediaInput[];
    parentId?: string | null;
    quotedPostId?: string | null;
  }): Promise<AxiosResponse<PostItem>> =>
    apiClient.post<PostItem>("/posts", data),

  updatePost: (
    id: string,
    data: { content?: string; visibility?: "PUBLIC" | "FOLLOWERS" | "PRIVATE" },
  ): Promise<AxiosResponse<PostItem>> =>
    apiClient.patch<PostItem>(`/posts/${id}`, data),

  deletePost: (id: string): Promise<AxiosResponse<void>> =>
    apiClient.delete(`/posts/${id}`),

  likePost: (id: string): Promise<AxiosResponse<void>> =>
    apiClient.post(`/posts/${id}/like`),

  unlikePost: (id: string): Promise<AxiosResponse<void>> =>
    apiClient.delete(`/posts/${id}/like`),

  repost: (id: string): Promise<AxiosResponse<void>> =>
    apiClient.post(`/posts/${id}/repost`),

  unrepost: (id: string): Promise<AxiosResponse<void>> =>
    apiClient.delete(`/posts/${id}/repost`),

  bookmark: (id: string): Promise<AxiosResponse<void>> =>
    apiClient.post(`/posts/${id}/bookmark`),

  unbookmark: (id: string): Promise<AxiosResponse<void>> =>
    apiClient.delete(`/posts/${id}/bookmark`),

  getBookmarks: (
    cursor?: string | null,
  ): Promise<AxiosResponse<CursorPage<PostItem>>> =>
    apiClient.get<CursorPage<PostItem>>("/posts/bookmarks", {
      params: { cursor, limit: 20 },
    }),

  getLikedPosts: (
    cursor?: string | null,
  ): Promise<AxiosResponse<CursorPage<PostItem>>> =>
    apiClient.get<CursorPage<PostItem>>("/posts/liked", {
      params: { cursor, limit: 20 },
    }),
};
