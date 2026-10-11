import {Injectable, Logger} from "@nestjs/common";
import {OnEvent} from "@nestjs/event-emitter";
import {PrismaService} from "../prisma/prisma.service.js";
import {EventsGateway} from "../gateway/events.gateway.js";
import {
  POST_EVENTS,
  PostLikedEvent,
  PostQuotedEvent,
  PostRepliedEvent,
  PostRepostedEvent,
  USER_EVENTS,
  UserFollowedEvent,
} from "../events/event-types.js";

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  @OnEvent(POST_EVENTS.LIKED)
  async handlePostLiked(event: PostLikedEvent) {
    if (event.actorId === event.postAuthorId) return;

    try {
      const existing = await this.prisma.client.orm.public.Notification.where(
        (n) => n.recipientId.eq(event.postAuthorId),
      )
        .where((n) => n.actorId.eq(event.actorId))
        .where((n) => n.type.eq("LIKE"))
        .where((n) => n.postId.eq(event.postId))
        .first();

      if (existing) {
        if (existing.isRead) {
          await this.prisma.client.orm.public.Notification.where({
            id: existing.id,
          }).update({ isRead: false, createdAt: new Date() });
          await this.sendRealtimeNotification(existing.id, event.postAuthorId);
        }
        return;
      }

      const created = await this.prisma.client.orm.public.Notification.create({
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
      const created = await this.prisma.client.orm.public.Notification.create({
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
      const existing = await this.prisma.client.orm.public.Notification.where(
        (n) => n.recipientId.eq(event.postAuthorId),
      )
        .where((n) => n.actorId.eq(event.actorId))
        .where((n) => n.type.eq("REPOST"))
        .where((n) => n.postId.eq(event.postId))
        .first();

      if (existing) {
        if (existing.isRead) {
          await this.prisma.client.orm.public.Notification.where({
            id: existing.id,
          }).update({ isRead: false, createdAt: new Date() });
          await this.sendRealtimeNotification(existing.id, event.postAuthorId);
        }
        return;
      }

      const created = await this.prisma.client.orm.public.Notification.create({
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
      const created = await this.prisma.client.orm.public.Notification.create({
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
      const existing = await this.prisma.client.orm.public.Notification.where(
        (n) => n.recipientId.eq(event.followingId),
      )
        .where((n) => n.actorId.eq(event.followerId))
        .where((n) => n.type.eq("FOLLOW"))
        .first();

      if (existing) {
        if (existing.isRead) {
          await this.prisma.client.orm.public.Notification.where({
            id: existing.id,
          }).update({ isRead: false, createdAt: new Date() });
          await this.sendRealtimeNotification(existing.id, event.followingId);
        }
        return;
      }

      const created = await this.prisma.client.orm.public.Notification.create({
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
      const notif = await this.prisma.client.orm.public.Notification.where({
        id: notificationId,
      })
        .include("actor")
        .include("post")
        .first();

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

      const unreadAgg = await this.prisma.client.orm.public.Notification.where(
        (n) => n.recipientId.eq(recipientId),
      )
        .where((n) => n.isRead.eq(false))
        .aggregate((a) => ({ count: a.count() }));

      this.eventsGateway.pushToUser(recipientId, "notification:unread-count", {
        count: Number(unreadAgg.count) || 0,
      });
    } catch (err) {
      this.logger.error(
        `Lỗi khi bắn realtime notification ${notificationId}:`,
        err,
      );
    }
  }
}
