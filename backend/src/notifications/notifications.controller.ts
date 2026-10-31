import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { NotificationsService } from "./notifications.service.js";
import { NotificationPaginationDto } from "./dto/notification-pagination.dto.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type {
  MarkAllReadResultDto,
  MarkReadResultDto,
  NotificationPaginatedResponseDto,
  UnreadCountResponseDto,
} from "./dto/notification-response.dto.js";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  async getNotifications(
    @CurrentUser("sub") userId: string,
    @Query() query: NotificationPaginationDto,
  ): Promise<NotificationPaginatedResponseDto> {
    return this.notificationsService.getNotifications(userId, query);
  }

  @Get("unread-count")
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  async getUnreadCount(
    @CurrentUser("sub") userId: string,
  ): Promise<UnreadCountResponseDto> {
    return this.notificationsService.getUnreadCount(userId);
  }

  @Patch(":id/read")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async markAsRead(
    @CurrentUser("sub") userId: string,
    @Param("id") id: string,
  ): Promise<MarkReadResultDto> {
    return this.notificationsService.markAsRead(userId, id);
  }

  @Post("read-all")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async markAllAsRead(
    @CurrentUser("sub") userId: string,
  ): Promise<MarkAllReadResultDto> {
    return this.notificationsService.markAllAsRead(userId);
  }
}
