import { Injectable, Logger, Optional } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { PrismaService } from "../prisma/prisma.service.js";
import { EventsGateway } from "../gateway/events.gateway.js";
import { UsersService } from "../users/users.service.js";
import { POST_EVENTS, USER_EVENTS } from "../events/event-types.js";
import { NotificationsRepository } from "./notifications.repository.js";
import type {
  PostCreatedEvent,
  PostLikedEvent,
  PostQuotedEvent,
  PostRepliedEvent,
  PostRepostedEvent,
  UserFollowedEvent,
} from "../events/event-types.js";

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);
  private readonly notificationsRepository: NotificationsRepository;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    private readonly usersService: UsersService,
    @Optional()
    notificationsRepository?: NotificationsRepository,
  ) {
    this.notificationsRepository =
      notificationsRepository ?? new NotificationsRepository(this.prisma);
  }

  @OnEvent(POST_EVENTS.CREATED)
  async handlePostCreated(event: PostCreatedEvent) {
    if (!event.isRootPost) return;

    try {
      const followerIds = await this.usersService.getFollowerIds(
        event.authorId,
      );

      if (!followerIds || followerIds.length === 0) return;

      for (const followerId of followerIds) {
        if (this.eventsGateway.isUserOnline(followerId)) {
          this.eventsGateway.pushToUser(followerId, "feed:new-post", {
            authorId: event.authorId,
            postId: event.postId,
          });
        }
      }
    } catch (error) {
      this.logger.error("Lỗi khi bắn event feed:new-post:", error);
    }
  }

  @OnEvent(POST_EVENTS.LIKED)
  async handlePostLiked(event: PostLikedEvent) {
    if (event.actorId === event.postAuthorId) return;

    try {
      const existing = await this.notificationsRepository.findExisting(
        event.postAuthorId,
        event.actorId,
        "LIKE",
        event.postId,
      );

      if (existing) {
        if (existing.isRead) {
          await this.notificationsRepository.touchNotification(existing.id);
          await this.sendRealtimeNotification(existing.id, event.postAuthorId);
        }
        return;
      }

      const created = await this.notificationsRepository.createNotification({
        recipientId: event.postAuthorId,
        actorId: event.actorId,
        type: "LIKE",
        postId: event.postId,
      });

      await this.sendRealtimeNotification(created.id, event.postAuthorId);
    } catch (error) {
      this.logger.error("Lỗi khi tạo notification LIKE:", error);
    }
  }

  @OnEvent(POST_EVENTS.REPLIED)
  async handlePostReplied(event: PostRepliedEvent) {
    if (event.actorId === event.parentAuthorId) return;

    try {
      const created = await this.notificationsRepository.createNotification({
        recipientId: event.parentAuthorId,
        actorId: event.actorId,
        type: "REPLY",
        postId: event.postId,
      });

      await this.sendRealtimeNotification(created.id, event.parentAuthorId);
    } catch (error) {
      this.logger.error("Lỗi khi tạo notification REPLY:", error);
    }
  }

  @OnEvent(POST_EVENTS.REPOSTED)
  async handlePostReposted(event: PostRepostedEvent) {
    if (event.actorId === event.postAuthorId) return;

    try {
      const existing = await this.notificationsRepository.findExisting(
        event.postAuthorId,
        event.actorId,
        "REPOST",
        event.postId,
      );

      if (existing) {
        if (existing.isRead) {
          await this.notificationsRepository.touchNotification(existing.id);
          await this.sendRealtimeNotification(existing.id, event.postAuthorId);
        }
        return;
      }

      const created = await this.notificationsRepository.createNotification({
        recipientId: event.postAuthorId,
        actorId: event.actorId,
        type: "REPOST",
        postId: event.postId,
      });

      await this.sendRealtimeNotification(created.id, event.postAuthorId);
    } catch (error) {
      this.logger.error("Lỗi khi tạo notification REPOST:", error);
    }
  }

  @OnEvent(POST_EVENTS.QUOTED)
  async handlePostQuoted(event: PostQuotedEvent) {
    if (event.actorId === event.quotedPostAuthorId) return;

    try {
      const created = await this.notificationsRepository.createNotification({
        recipientId: event.quotedPostAuthorId,
        actorId: event.actorId,
        type: "QUOTE",
        postId: event.postId,
      });

      await this.sendRealtimeNotification(created.id, event.quotedPostAuthorId);
    } catch (error) {
      this.logger.error("Lỗi khi tạo notification QUOTE:", error);
    }
  }

  @OnEvent(USER_EVENTS.FOLLOWED)
  async handleUserFollowed(event: UserFollowedEvent) {
    if (event.followerId === event.followingId) return;

    try {
      const existing = await this.notificationsRepository.findExisting(
        event.followingId,
        event.followerId,
        "FOLLOW",
      );

      if (existing) {
        if (existing.isRead) {
          await this.notificationsRepository.touchNotification(existing.id);
          await this.sendRealtimeNotification(existing.id, event.followingId);
        }
        return;
      }

      const created = await this.notificationsRepository.createNotification({
        recipientId: event.followingId,
        actorId: event.followerId,
        type: "FOLLOW",
      });

      await this.sendRealtimeNotification(created.id, event.followingId);
    } catch (error) {
      this.logger.error("Lỗi khi tạo notification FOLLOW:", error);
    }
  }

  private async sendRealtimeNotification(
    notificationId: string,
    recipientId: string,
  ) {
    try {
      const notif =
        await this.notificationsRepository.findByIdWithDetails(notificationId);

      if (!notif) return;

      this.eventsGateway.pushToUser(recipientId, "notification:new", {
        id: notif.id,
        type: notif.type,
        isRead: notif.isRead,
        createdAt: notif.createdAt,
        actor: {
          id: notif.actor.id,
          username: notif.actor.username,
          displayName: notif.actor.displayName,
          avatarUrl: notif.actor.avatarUrl,
        },
        post: notif.post
          ? {
              id: notif.post.id,
              content: notif.post.content
                ? notif.post.content.slice(0, 100)
                : null,
            }
          : null,
      });

      const unreadCount =
        await this.notificationsRepository.countUnread(recipientId);

      this.eventsGateway.pushToUser(recipientId, "notification:unread-count", {
        count: unreadCount,
      });
    } catch (err) {
      this.logger.error(
        `Lỗi khi bắn realtime notification ${notificationId}:`,
        err,
      );
    }
  }
}
