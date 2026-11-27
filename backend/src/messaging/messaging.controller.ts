import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { MediaService } from "../media/media.service.js";
import { ConversationPaginationDto } from "./dto/conversation-pagination.dto.js";
import { CreateDirectConversationDto } from "./dto/create-direct-conversation.dto.js";
import type {
  ConversationPageDto,
  ConversationResponseDto,
  MarkConversationReadDto,
  MessagePageDto,
  MessageResponseDto,
  UnreadMessagesCountDto,
} from "./dto/messaging-response.dto.js";
import { SendMessageDto } from "./dto/send-message.dto.js";
import { MessagingService } from "./messaging.service.js";

@Controller("conversations")
@UseGuards(JwtAuthGuard)
export class MessagingController {
  constructor(
    private readonly messagingService: MessagingService,
    private readonly mediaService: MediaService,
  ) {}

  @Post(":id/media/upload-signature")
  @Throttle({ default: { limit: 25, ttl: 60000 } })
  async getMessageUploadSignature(
    @CurrentUser("sub") userId: string,
    @Param("id") conversationId: string,
  ) {
    await this.messagingService.getConversation(userId, conversationId);
    return this.mediaService.generateUploadSignature("messages", userId, "image");
  }

  @Get()
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  async getConversations(
    @CurrentUser("sub") userId: string,
    @Query() query: ConversationPaginationDto,
  ): Promise<ConversationPageDto> {
    return this.messagingService.getConversations(userId, query);
  }

  @Get("unread-count")
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  async getUnreadCount(@CurrentUser("sub") userId: string): Promise<UnreadMessagesCountDto> {
    return this.messagingService.getUnreadCount(userId);
  }

  @Post("direct")
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async getOrCreateDirectConversation(
    @CurrentUser("sub") userId: string,
    @Body() dto: CreateDirectConversationDto,
  ): Promise<ConversationResponseDto> {
    return this.messagingService.getOrCreateDirectConversation(userId, dto);
  }

  @Get(":id/messages")
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  async getMessages(
    @CurrentUser("sub") userId: string,
    @Param("id") conversationId: string,
    @Query() query: ConversationPaginationDto,
  ): Promise<MessagePageDto> {
    return this.messagingService.getMessages(userId, conversationId, query);
  }

  @Get(":id")
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  async getConversation(
    @CurrentUser("sub") userId: string,
    @Param("id") conversationId: string,
  ): Promise<ConversationResponseDto> {
    return this.messagingService.getConversation(userId, conversationId);
  }

  @Post(":id/messages")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async sendMessage(
    @CurrentUser("sub") userId: string,
    @Param("id") conversationId: string,
    @Body() dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    return this.messagingService.sendMessage(userId, conversationId, dto);
  }

  @Post(":id/read")
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async markConversationRead(
    @CurrentUser("sub") userId: string,
    @Param("id") conversationId: string,
  ): Promise<MarkConversationReadDto> {
    return this.messagingService.markConversationRead(userId, conversationId);
  }
}
