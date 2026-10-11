import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationPaginationDto } from './dto/notification-pagination.dto.js';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getNotifications(userId: string, query: NotificationPaginationDto) {
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));

    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(query.cursor, 'base64').toString('utf8'),
        );
        cursor = {
          createdAt: new Date(decoded.createdAt),
          id: decoded.id,
        };
      } catch {
        // Cursor không hợp lệ thì bỏ qua
      }
    }

    let q = this.prisma.client.orm.public.Notification
      .where((n) => n.recipientId.eq(userId))
      .orderBy([(n) => n.createdAt.desc(), (n) => n.id.desc()]);

    if (cursor) {
      q = q.cursor({
        createdAt: cursor.createdAt,
        id: cursor.id,
      });
    }

    const items = await q
      .include('actor')
      .include('post')
      .limit(limit + 1)
      .all();

    const hasMore = items.length > limit;
    const dataItems = hasMore ? items.slice(0, limit) : items;

    let nextCursor: string | null = null;
    if (hasMore && dataItems.length > 0) {
      const last = dataItems[dataItems.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ createdAt: last.createdAt, id: last.id }),
      ).toString('base64');
    }

    const formattedData = dataItems.map((item: any) => ({
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
            content: item.post.content
              ? item.post.content.slice(0, 100)
              : null,
          }
        : null,
    }));

    return {
      data: formattedData,
      nextCursor,
      hasMore,
    };
  }

  async getUnreadCount(userId: string) {
    const agg = await this.prisma.client.orm.public.Notification
      .where((n) => n.recipientId.eq(userId))
      .where((n) => n.isRead.eq(false))
      .aggregate((a) => ({ count: a.count() }));

    return {
      count: Number(agg.count) || 0,
    };
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await this.prisma.client.orm.public.Notification
      .where({ id: notificationId })
      .first();

    if (!notification || notification.recipientId !== userId) {
      throw new NotFoundException('Thông báo không tồn tại');
    }

    if (!notification.isRead) {
      await this.prisma.client.orm.public.Notification
        .where({ id: notificationId })
        .update({ isRead: true });
    }

    return {
      success: true,
      id: notificationId,
    };
  }

  async markAllAsRead(userId: string) {
    const rawPlan = this.prisma.client.raw.sql`
      UPDATE "notification"
      SET "isRead" = true
      WHERE "recipientId" = ${userId} AND "isRead" = false
    `
      .affectedCount()
      .build();

    const affected = await this.prisma.client.transaction(async (tx) => {
      return await tx.execute(rawPlan);
    });

    return {
      success: true,
      count: affected,
    };
  }
}
