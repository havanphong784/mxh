import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  POST_EVENTS,
  USER_EVENTS,
  PostLikedEvent,
  PostRepliedEvent,
  PostRepostedEvent,
  PostQuotedEvent,
  UserFollowedEvent,
} from '../events/event-types.js';

@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name);

  constructor(private readonly prisma: PrismaService) {}

  @OnEvent(POST_EVENTS.LIKED)
  async handlePostLiked(event: PostLikedEvent) {
    if (event.actorId === event.postAuthorId) return;

    try {
      // Tránh trùng lặp nếu người dùng unlike rồi like lại
      const existing = await this.prisma.client.orm.public.Notification
        .where((n) => n.recipientId.eq(event.postAuthorId))
        .where((n) => n.actorId.eq(event.actorId))
        .where((n) => n.type.eq('LIKE'))
        .where((n) => n.postId.eq(event.postId))
        .first();

      if (existing) {
        if (existing.isRead) {
          await this.prisma.client.orm.public.Notification
            .where({ id: existing.id })
            .update({ isRead: false, createdAt: new Date() });
        }
        return;
      }

      await this.prisma.client.orm.public.Notification.create({
        recipientId: event.postAuthorId,
        actorId: event.actorId,
        type: 'LIKE',
        postId: event.postId,
      });
    } catch (error) {
      this.logger.error('Lỗi khi tạo notification LIKE:', error);
    }
  }

  @OnEvent(POST_EVENTS.REPLIED)
  async handlePostReplied(event: PostRepliedEvent) {
    if (event.actorId === event.parentAuthorId) return;

    try {
      await this.prisma.client.orm.public.Notification.create({
        recipientId: event.parentAuthorId,
        actorId: event.actorId,
        type: 'REPLY',
        postId: event.postId,
      });
    } catch (error) {
      this.logger.error('Lỗi khi tạo notification REPLY:', error);
    }
  }

  @OnEvent(POST_EVENTS.REPOSTED)
  async handlePostReposted(event: PostRepostedEvent) {
    if (event.actorId === event.postAuthorId) return;

    try {
      const existing = await this.prisma.client.orm.public.Notification
        .where((n) => n.recipientId.eq(event.postAuthorId))
        .where((n) => n.actorId.eq(event.actorId))
        .where((n) => n.type.eq('REPOST'))
        .where((n) => n.postId.eq(event.postId))
        .first();

      if (!existing) {
        await this.prisma.client.orm.public.Notification.create({
          recipientId: event.postAuthorId,
          actorId: event.actorId,
          type: 'REPOST',
          postId: event.postId,
        });
      }
    } catch (error) {
      this.logger.error('Lỗi khi tạo notification REPOST:', error);
    }
  }

  @OnEvent(POST_EVENTS.QUOTED)
  async handlePostQuoted(event: PostQuotedEvent) {
    if (event.actorId === event.quotedPostAuthorId) return;

    try {
      await this.prisma.client.orm.public.Notification.create({
        recipientId: event.quotedPostAuthorId,
        actorId: event.actorId,
        type: 'QUOTE',
        postId: event.postId,
      });
    } catch (error) {
      this.logger.error('Lỗi khi tạo notification QUOTE:', error);
    }
  }

  @OnEvent(USER_EVENTS.FOLLOWED)
  async handleUserFollowed(event: UserFollowedEvent) {
    if (event.followerId === event.followingId) return;

    try {
      const existing = await this.prisma.client.orm.public.Notification
        .where((n) => n.recipientId.eq(event.followingId))
        .where((n) => n.actorId.eq(event.followerId))
        .where((n) => n.type.eq('FOLLOW'))
        .first();

      if (!existing) {
        await this.prisma.client.orm.public.Notification.create({
          recipientId: event.followingId,
          actorId: event.followerId,
          type: 'FOLLOW',
        });
      }
    } catch (error) {
      this.logger.error('Lỗi khi tạo notification FOLLOW:', error);
    }
  }
}
