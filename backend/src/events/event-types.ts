export const POST_EVENTS = {
    CREATED: 'post.created',
    LIKED: 'post.liked',
    REPLIED: 'post.replied',
    REPOSTED: 'post.reposted',
    QUOTED: 'post.quoted',
} as const;

export const USER_EVENTS = {
    FOLLOWED: 'user.followed',
} as const;

export interface PostCreatedEvent {
    authorId: string;
    postId: string;
    isRootPost: boolean;
}

export interface PostLikedEvent {
    actorId: string;       // Người bấm like
    postId: string;        // ID bài viết được like
    postAuthorId: string;  // Tác giả bài viết (người nhận thông báo)
}

export interface PostRepliedEvent {
    actorId: string;        // Người bình luận
    postId: string;         // ID của câu trả lời (reply)
    parentId: string;       // ID bài viết cha được trả lời
    parentAuthorId: string; // Tác giả bài viết cha
}

export interface PostRepostedEvent {
    actorId: string;       // Người repost
    postId: string;        // ID bài viết gốc
    postAuthorId: string;  // Tác giả bài viết gốc
}

export interface PostQuotedEvent {
    actorId: string;             // Người trích dẫn
    postId: string;              // ID bài viết quote mới tạo
    quotedPostId: string;        // ID bài viết được trích dẫn
    quotedPostAuthorId: string;  // Tác giả bài viết được trích dẫn
}

export interface UserFollowedEvent {
    followerId: string;   // Người bấm follow
    followingId: string;  // Người được follow
}