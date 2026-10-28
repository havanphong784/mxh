export interface NotificationActorDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface NotificationPostDto {
  id: string;
  content: string | null;
}

export interface NotificationItemDto {
  id: string;
  type: "LIKE" | "REPLY" | "REPOST" | "QUOTE" | "FOLLOW";
  isRead: boolean;
  createdAt: any;
  actor: NotificationActorDto | null;
  post: NotificationPostDto | null;
}

export interface NotificationPaginatedResponseDto {
  data: NotificationItemDto[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface UnreadCountResponseDto {
  count: number;
}

export interface MarkReadResultDto {
  success: boolean;
  id: string;
}

export interface MarkAllReadResultDto {
  success: boolean;
  count: number;
}

export class NotificationResponseMapper {
  static toItemDto(item: any): NotificationItemDto {
    return {
      id: item.id,
      type: item.type,
      isRead: item.isRead,
      createdAt: item.createdAt,
      actor: item.actor
        ? {
            id: item.actor.id,
            username: item.actor.username,
            displayName: item.actor.displayName,
            avatarUrl: item.actor.avatarUrl,
          }
        : null,
      post: item.post
        ? {
            id: item.post.id,
            content: item.post.content ? item.post.content.slice(0, 100) : null,
          }
        : null,
    };
  }
}
