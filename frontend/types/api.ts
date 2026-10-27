export type PostVisibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
export type MediaType = 'IMAGE' | 'VIDEO';
export type NotificationType = 'LIKE' | 'REPLY' | 'REPOST' | 'QUOTE' | 'FOLLOW';

export interface ApiMessageResponse {
    message: string;
}

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

export interface UploadSignature {
    signature: string;
    timestamp: number;
    apiKey: string;
    cloudName: string;
    folder: string;
    resourceType: 'image' | 'video';
}

export interface UploadedMedia {
    publicId: string;
    version: number;
    signature: string;
    type: MediaType;
    order: number;
    width: number | null;
    height: number | null;
    duration: number | null;
    url: string;
}

export interface PostMediaInput {
    publicId: string;
    version: string;
    signature: string;
    type: MediaType;
    order: number;
    width?: number;
    height?: number;
    duration?: number;
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

export interface QuotedPostItem {
    id: string;
    content: string | null;
    createdAt: string;
    author: Author | null;
    media: PostMedia[];
}

export interface ActivePostItem {
    id: string;
    content: string | null;
    visibility: PostVisibility;
    parentId: string | null;
    rootId: string | null;
    repostOfId: string | null;
    quotedPostId: string | null;
    quotedPost?: QuotedPostItem | null;
    isQuotedPostDeleted?: boolean;
    isDeleted: false;
    isUnavailable?: false;
    editedAt: string | null;
    createdAt: string;
    author: Author;
    media: PostMedia[];
    counters: PostCounters;
    interactions: PostInteractions;
}

export interface DeletedPostItem {
    id: string;
    createdAt: string;
    isDeleted: true;
    isUnavailable?: false;
    replyCount?: number;
}

export interface UnavailablePostItem {
    id: string;
    createdAt: string;
    parentId?: string | null;
    rootId?: string | null;
    isDeleted?: false;
    isUnavailable: true;
    replyCount?: number;
}

export type PostItem = ActivePostItem | DeletedPostItem | UnavailablePostItem;

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
    } | null;
    post: {
        id: string;
        content: string | null;
    } | null;
}

export interface CursorPage<T> {
    items: T[];
    nextCursor: string | null;
}

export interface CursorDataPage<T> {
    data: T[];
    nextCursor: string | null;
    hasMore: boolean;
}

export interface OffsetPage<T> {
    items: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface UserProfile extends Author {
    bannerUrl: string | null;
    followersCount: number;
    followingCount: number;
    isFollowing: boolean;
    createdAt: string;
}

export interface OwnProfile extends Omit<UserProfile, 'isFollowing'> {
    email: string;
    avatarPublicId: string | null;
    bannerPublicId: string | null;
    isEmailVerified: boolean;
}

export interface AuthResponse {
    message: string;
    accessToken: string;
    user: Author;
}

export interface RefreshResponse {
    message: string;
    accessToken: string;
}

export interface RegisterResponse {
    message: string;
    email: string;
}

export interface UnreadCountResponse {
    count: number;
}
