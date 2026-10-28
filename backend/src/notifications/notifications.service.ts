import { Injectable, NotFoundException, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { NotificationPaginationDto } from "./dto/notification-pagination.dto.js";
import { EventsGateway } from "../gateway/events.gateway.js";
import { Temporal } from "@js-temporal/polyfill";
import { NotificationsRepository } from "./notifications.repository.js";
import {
  MarkAllReadResultDto,
  MarkReadResultDto,
  NotificationPaginatedResponseDto,
  NotificationResponseMapper,
  UnreadCountResponseDto,
} from "./dto/notification-response.dto.js";

@Injectable()
export class NotificationsService {
  private readonly notificationsRepository: NotificationsRepository;

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    @Optional()
    notificationsRepository?: NotificationsRepository,
  ) {
    this.notificationsRepository =
      notificationsRepository ?? new NotificationsRepository(this.prisma);
  }

  async getNotifications(
    userId: string,
    query: NotificationPaginationDto,
  ): Promise<NotificationPaginatedResponseDto> {
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));

    let cursor: { createdAt: Temporal.Instant; id: string } | undefined;
    if (query.cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(query.cursor, "base64").toString("utf8"),
        );
        if (
          typeof decoded === "object" &&
          decoded !== null &&
          typeof decoded.createdAt === "string" &&
          typeof decoded.id === "string" &&
          decoded.id.length > 0
        ) {
          cursor = { createdAt: Temporal.Instant.from(decoded.createdAt), id: decoded.id };
        }
      } catch {
        // Cursor không hợp lệ thì bỏ qua
      }
    }

    const items = await this.notificationsRepository.findManyWithCursor(
      userId,
      limit,
      cursor,
    );

    const hasMore = items.length > limit;
    const dataItems = hasMore ? items.slice(0, limit) : items;

    let nextCursor: string | null = null;
    if (hasMore && dataItems.length > 0) {
      const last = dataItems[dataItems.length - 1];
      nextCursor = Buffer.from(
        JSON.stringify({ createdAt: last.createdAt, id: last.id }),
      ).toString("base64");
    }

    return {
      data: dataItems.map(NotificationResponseMapper.toItemDto),
      nextCursor,
      hasMore,
    };
  }

  async getUnreadCount(userId: string): Promise<UnreadCountResponseDto> {
    const count = await this.notificationsRepository.countUnread(userId);
    return { count };
  }

  async markAsRead(
    userId: string,
    notificationId: string,
  ): Promise<MarkReadResultDto> {
    const notification =
      await this.notificationsRepository.findById(notificationId);

    if (!notification || notification.recipientId !== userId) {
      throw new NotFoundException("Thông báo không tồn tại");
    }

    if (!notification.isRead) {
      await this.notificationsRepository.markAsRead(notificationId);

      const unread = await this.getUnreadCount(userId);
      this.eventsGateway.pushToUser(
        userId,
        "notification:unread-count",
        unread,
      );
    }

    return {
      success: true,
      id: notificationId,
    };
  }

  async markAllAsRead(userId: string): Promise<MarkAllReadResultDto> {
    const affectedRows =
      await this.notificationsRepository.markAllAsRead(userId);

    this.eventsGateway.pushToUser(userId, "notification:unread-count", {
      count: 0,
    });

    return {
      success: true,
      count: affectedRows,
    };
  }
}
