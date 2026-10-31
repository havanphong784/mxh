import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { Temporal } from "@js-temporal/polyfill";

@Injectable()
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  get notification() {
    return this.prisma.client.orm.public.Notification;
  }

  async findManyWithCursor(
    userId: string,
    limit: number,
    cursor?: { createdAt: Temporal.Instant; id: string },
  ) {
    let q = this.notification
      .where((n: any) => n.recipientId.eq(userId))
      .orderBy([(n: any) => n.createdAt.desc(), (n: any) => n.id.desc()]);

    if (cursor) {
      q = q.cursor({
        createdAt: cursor.createdAt,
        id: cursor.id,
      });
    }

    return q
      .include("actor")
      .include("post")
      .limit(limit + 1)
      .all();
  }

  async countUnread(userId: string): Promise<number> {
    const agg = await this.notification
      .where((n: any) => n.recipientId.eq(userId))
      .where((n: any) => n.isRead.eq(false))
      .aggregate((a: any) => ({ count: a.count() }));

    return Number(agg.count) || 0;
  }

  async findById(notificationId: string) {
    return this.notification.where({ id: notificationId }).first();
  }

  async findByIdWithDetails(notificationId: string) {
    return this.notification
      .where({ id: notificationId })
      .include("actor")
      .include("post")
      .first();
  }

  async markAsRead(notificationId: string): Promise<void> {
    await this.notification
      .where({ id: notificationId })
      .update({ isRead: true });
  }

  async markAllAsRead(userId: string): Promise<number> {
    const rawPlan = this.prisma.client.raw.sql`
      UPDATE "notification"
      SET "isRead" = true
      WHERE "recipientId" = ${userId} AND "isRead" = false
    `
      .affectedCount()
      .build();

    const { affectedRows } = await this.prisma.client.transaction(
      async (tx: any) => {
        return await tx.execute(rawPlan);
      },
    );

    return affectedRows;
  }

  async findExisting(
    recipientId: string,
    actorId: string,
    type: string,
    postId?: string,
  ) {
    let q = this.notification
      .where((n: any) => n.recipientId.eq(recipientId))
      .where((n: any) => n.actorId.eq(actorId))
      .where((n: any) => n.type.eq(type));

    if (postId) {
      q = q.where((n: any) => n.postId.eq(postId));
    }

    return q.first();
  }

  async touchNotification(notificationId: string): Promise<void> {
    await this.notification
      .where({ id: notificationId })
      .update({ isRead: false, createdAt: Temporal.Now.instant() });
  }

  async createNotification(data: {
    recipientId: string;
    actorId: string;
    type: "LIKE" | "REPLY" | "REPOST" | "QUOTE" | "FOLLOW";
    postId?: string;
  }) {
    return this.notification.create(data);
  }
}
