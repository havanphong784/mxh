export type PostVisibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
export type MediaType = 'IMAGE' | 'VIDEO';
export type NotificationType = 'LIKE' | 'REPLY' | 'REPOST' | 'QUOTE' | 'FOLLOW';

export interface Author {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio?: string | null;
}

export interface PostMedia {
    id: string;
    publicId: string;
    url: string;
    type: MediaType;
    width: number | null;
    height: number | null;
    duration: number | null;
    order: number;
}

export interface PostCounters {
    likeCount: number;
    replyCount: number;
    repostCount: number;
    quoteCount: number;
    bookmarkCount: number;
}

export interface PostInteractions {
    isLiked: boolean;
    isReposted: boolean;
    isBookmarked: boolean;
}

export interface PostItem {
    id: string;
    content: string | null;
    visibility: PostVisibility;
    parentId: string | null;
    rootId: string | null;
    repostOfId: string | null;
    quotedPostId: string | null;
    quotedPost?: PostItem | null;
    isQuotedPostDeleted?: boolean;
    isDeleted: boolean;
    isUnavailable?: boolean;
    editedAt: string | null;
    createdAt: string;
    author: Author;
    media: PostMedia[];
    counters: PostCounters;
    interactions: PostInteractions;
}

export interface NotificationItem {
    id: string;
    type: NotificationType;
    isRead: boolean;
    createdAt: string;
    actor: {
        id: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
    };
    post: {
        id: string;
        content: string | null;
    } | null;
}

export interface CursorPage<T> {
    data: T[];
    nextCursor: string | null;
    hasMore: boolean;
}

export interface OffsetPage<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}