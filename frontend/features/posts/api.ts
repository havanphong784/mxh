import { apiClient } from '@/lib/axios';
import type { CursorPage, OffsetPage, PostItem } from '@/types/api';

export const postsApi = {
  getFeed: (cursor?: string | null) =>
    apiClient.get<CursorPage<PostItem>>('/posts/feed', { params: { limit: 20, cursor } }),

  getExplore: (cursor?: string | null) =>
    apiClient.get<CursorPage<PostItem>>('/posts/explore', { params: { limit: 20, cursor } }),

  getPost: (id: string) => apiClient.get<PostItem>(`/posts/${id}`),

  getAncestors: (id: string) => apiClient.get<PostItem[]>(`/posts/${id}/ancestors`),

  getReplies: (id: string, cursor?: string | null) =>
    apiClient.get<CursorPage<PostItem>>(`/posts/${id}/replies`, { params: { limit: 20, cursor } }),

  createPost: (data: {
    content?: string | null;
    visibility?: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
    media?: any[];
    parentId?: string | null;
    quotedPostId?: string | null;
  }) => apiClient.post<PostItem>('/posts', data),

  deletePost: (id: string) => apiClient.delete(`/posts/${id}`),

  likePost: (id: string) => apiClient.post(`/posts/${id}/like`),
  unlikePost: (id: string) => apiClient.delete(`/posts/${id}/like`),

  repost: (id: string) => apiClient.post(`/posts/${id}/repost`),
  unrepost: (id: string) => apiClient.delete(`/posts/${id}/repost`),

  bookmark: (id: string) => apiClient.post(`/posts/${id}/bookmark`),
  unbookmark: (id: string) => apiClient.delete(`/posts/${id}/bookmark`),

  getBookmarks: (page: number = 1, limit: number = 20) =>
    apiClient.get<OffsetPage<PostItem>>('/posts/bookmarks', { params: { page, limit } }),
};
