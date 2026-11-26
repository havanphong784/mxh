import { Temporal } from "@js-temporal/polyfill";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { MESSAGE_EVENTS } from "../events/event-types.js";
import { EventsGateway } from "../gateway/events.gateway.js";
import { MediaService } from "../media/media.service.js";
import { ConversationPaginationDto } from "./dto/conversation-pagination.dto.js";
import { CreateDirectConversationDto } from "./dto/create-direct-conversation.dto.js";
import type {
  ConversationPageDto,
  ConversationResponseDto,
  MarkConversationReadDto,
  MessagePageDto,
  MessageResponseDto,
  MessagingUserDto,
  UnreadMessagesCountDto,
} from "./dto/messaging-response.dto.js";
import { SendMessageDto } from "./dto/send-message.dto.js";
import { MessageMediaService } from "./message-media.service.js";
import { purgeMessageMedia } from "./message-media-cleanup.js";
import type {
  ConversationParticipantRecord,
  ConversationWithParticipants,
  MessageMediaRecord,
  MessageRecord,
} from "./messaging.repository.js";
import { MessagingRepository } from "./messaging.repository.js";

@Injectable()
export class MessagingService {
  constructor(
    private readonly messagingRepository: MessagingRepository,
    private readonly eventsGateway: EventsGateway,
    private readonly messageMedia: MessageMediaService,
  ) {}

  async purgeUnusedMedia(media: MediaService, dryRun = true) {
    return purgeMessageMedia(
      {
        pending: () => this.messagingRepository.pendingMediaDeletions(),
        pages: () => media.listMessageImagePages(),
        reserve: (id) => this.messagingRepository.reserveMediaDeletion(id),
        remove: (id) => media.deleteMessageImage(id),
        complete: (id) => this.messagingRepository.completeMediaDeletion(id),
      },
      { dryRun, before: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    );
  }

  async getOrCreateDirectConversation(
    userId: string,
    dto: CreateDirectConversationDto,
  ): Promise<ConversationResponseDto> {
    if (userId === dto.targetUserId) {
      throw new BadRequestException("Bạn không thể nhắn tin cho chính mình");
    }

    const [actor, target] = await Promise.all([
      this.messagingRepository.findActiveUser(userId),
      this.messagingRepository.findActiveUser(dto.targetUserId),
    ]);

    if (!actor || !target) {
      throw new NotFoundException("Người dùng không tồn tại hoặc không còn hoạt động");
    }

    const directKey = [userId, dto.targetUserId].sort().join(":");
    let conversation = await this.messagingRepository.findDirectConversation(directKey);

    if (!conversation) {
      try {
        conversation = await this.messagingRepository.createDirectConversation(directKey, [
          userId,
          dto.targetUserId,
        ]);
      } catch {
        conversation = await this.messagingRepository.findDirectConversation(directKey);
        if (!conversation) throw new ConflictException("Không thể tạo cuộc trò chuyện");
      }
    }

    if (!conversation) {
      throw new ConflictException("Không thể tạo cuộc trò chuyện");
    }

    const result = await this.messagingRepository.findConversationForUser(conversation.id, userId);
    if (!result) throw new NotFoundException("Cuộc trò chuyện không tồn tại");

    return this.toConversationResponse(result.conversation, result.participant, userId);
  }

  async getConversations(
    userId: string,
    query: ConversationPaginationDto,
  ): Promise<ConversationPageDto> {
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const cursor = this.decodeConversationCursor(query.cursor);
    const { items, hasMore } = await this.messagingRepository.listConversations(
      userId,
      limit,
      cursor,
    );
    const conversationIds = items.map((conversation) => conversation.id);
    const [latestRows, unreadByConversation] = await Promise.all([
      this.messagingRepository.findLatestMessages(conversationIds),
      this.messagingRepository.countUnreadForConversations(conversationIds, userId),
    ]);
    const latestByConversation = new Map(
      latestRows.map((message) => [message.conversationId, message as MessageRecord]),
    );
    const mediaByMessage = await this.messagingRepository.findMediaForMessages(
      latestRows.map((message) => message.id),
    );
    const data = await Promise.all(
      items.map((conversation) => {
        const participant = conversation.participants.find((item) => item.userId === userId);
        return this.toConversationResponse(
          conversation,
          participant,
          userId,
          latestByConversation.get(conversation.id) ?? null,
          unreadByConversation.get(conversation.id) ?? 0,
          mediaByMessage,
        );
      }),
    );
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last ? this.encodeConversationCursor(last.updatedAt, last.id) : null;

    return {
      data,
      nextCursor,
      hasMore,
    };
  }

  async getTypingRecipient(userId: string, conversationId: string): Promise<string> {
    const member = await this.messagingRepository.findParticipant(conversationId, userId);
    if (!member) throw new ForbiddenException("Bạn không thuộc cuộc trò chuyện này");
    return (await this.getOtherParticipant(conversationId, userId)).userId;
  }

  async getConversation(userId: string, conversationId: string): Promise<ConversationResponseDto> {
    const result = await this.messagingRepository.findConversationForUser(conversationId, userId);
    if (!result)
      throw new NotFoundException("Cuộc trò chuyện không tồn tại hoặc bạn không có quyền xem");
    return this.toConversationResponse(result.conversation, result.participant, userId);
  }

  async getMessages(
    userId: string,
    conversationId: string,
    query: ConversationPaginationDto,
  ): Promise<MessagePageDto> {
    const participant = await this.messagingRepository.findParticipant(conversationId, userId);
    if (!participant) {
      throw new ForbiddenException("Bạn không có quyền xem cuộc trò chuyện này");
    }

    const limit = Math.min(50, Math.max(1, Number(query.limit) || 30));
    const cursor = this.decodeMessageCursor(query.cursor);
    const result = await this.messagingRepository.listMessages(conversationId, limit, cursor);
    const media = await this.messagingRepository.findMediaForMessages(
      result.items.map((message) => message.id),
    );
    const data = result.items.map((message) =>
      this.toMessageResponse(message, media.get(message.id)),
    );
    const nextCursor =
      result.hasMore && data.length
        ? this.encodeMessageCursor(data[0].createdAt, data[0].id)
        : null;

    return { data, nextCursor, hasMore: result.hasMore };
  }

  async sendMessage(
    userId: string,
    conversationId: string,
    dto: SendMessageDto,
  ): Promise<MessageResponseDto> {
    const participant = await this.messagingRepository.findParticipant(conversationId, userId);
    if (!participant) {
      throw new ForbiddenException("Bạn không có quyền gửi tin nhắn vào cuộc trò chuyện này");
    }

    const body = dto.body?.trim() ?? "";
    if ((!body && !dto.media?.length) || body.length > 2000)
      throw new BadRequestException("Tin nhắn cần nội dung tối đa 2000 ký tự hoặc ảnh");

    const existing = await this.messagingRepository.findMessageByClientId(
      userId,
      dto.clientMessageId,
    );
    if (existing) {
      if (existing.conversationId !== conversationId) {
        throw new ConflictException("clientMessageId đã được sử dụng cho tin nhắn khác");
      }
      return this.messageResponseWithMedia(existing);
    }

    const media = dto.media?.length ? await this.messageMedia.verify(userId, dto.media) : [];
    let message: MessageRecord;
    let created = false;
    try {
      const result = await this.messagingRepository.createMessage({
        conversationId,
        senderId: userId,
        clientMessageId: dto.clientMessageId,
        body,
        media,
      });
      message = result.message;
      created = result.created;
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      const retried = await this.messagingRepository.findMessageByClientId(
        userId,
        dto.clientMessageId,
      );
      if (!retried || retried.conversationId !== conversationId) {
        throw new ConflictException("Không thể gửi tin nhắn, vui lòng thử lại");
      }
      message = retried;
    }

    const response = await this.messageResponseWithMedia(message);
    if (!created) return response;

    const recipient = await this.getOtherParticipant(conversationId, userId);
    const event = {
      conversationId,
      message: response,
      senderId: userId,
      recipientId: recipient.userId,
    };

    this.eventsGateway.pushToUser(userId, MESSAGE_EVENTS.NEW_MESSAGE, event);
    this.eventsGateway.pushToUser(recipient.userId, MESSAGE_EVENTS.NEW_MESSAGE, event);

    this.eventsGateway.pushToUser(recipient.userId, MESSAGE_EVENTS.UNREAD_COUNT, {
      count: await this.getUnreadCountValue(recipient.userId),
    });

    return response;
  }

  async markConversationRead(
    userId: string,
    conversationId: string,
  ): Promise<MarkConversationReadDto> {
    const participant = await this.messagingRepository.findParticipant(conversationId, userId);
    if (!participant) {
      throw new ForbiddenException("Bạn không có quyền cập nhật cuộc trò chuyện này");
    }

    const readAt = Temporal.Now.instant();
    await this.messagingRepository.markAsRead(conversationId, userId, readAt);
    const unreadCount = await this.getUnreadCountValue(userId);

    this.eventsGateway.pushToUser(userId, MESSAGE_EVENTS.UNREAD_COUNT, {
      count: unreadCount,
    });
    this.eventsGateway.pushToUser(userId, MESSAGE_EVENTS.READ, {
      conversationId,
      userId,
      readAt,
    });

    return { success: true, conversationId, unreadCount };
  }

  async getUnreadCount(userId: string): Promise<UnreadMessagesCountDto> {
    return { count: await this.getUnreadCountValue(userId) };
  }

  private async getUnreadCountValue(userId: string): Promise<number> {
    return this.messagingRepository.countAllUnreadForUser(userId);
  }

  private async toConversationResponse(
    conversation: ConversationWithParticipants,
    participant: ConversationParticipantRecord | undefined,
    userId: string,
    prefetchedLastMessage?: MessageRecord | null,
    prefetchedUnreadCount?: number,
    prefetchedMedia?: Map<string, MessageMediaRecord[]>,
  ): Promise<ConversationResponseDto> {
    const participantRecord = this.getOtherParticipantRecord(conversation, userId);
    if (!participantRecord?.user || !participant) {
      throw new NotFoundException("Người tham gia cuộc trò chuyện không tồn tại");
    }

    const [lastMessage, unreadCount] =
      prefetchedUnreadCount !== undefined
        ? [prefetchedLastMessage ?? null, prefetchedUnreadCount]
        : await Promise.all([
            this.messagingRepository.findLatestMessage(conversation.id),
            this.messagingRepository.countUnreadForConversation(
              conversation.id,
              userId,
              participant.lastReadAt ?? null,
            ),
          ]);

    return {
      id: conversation.id,
      type: "DIRECT",
      participant: this.toUserResponse(participantRecord.user),
      lastMessage: lastMessage
        ? prefetchedMedia
          ? this.toMessageResponse(lastMessage, prefetchedMedia.get(lastMessage.id))
          : await this.messageResponseWithMedia(lastMessage)
        : null,
      unreadCount,
      updatedAt: conversation.updatedAt,
    };
  }

  private getOtherParticipantRecord(conversation: ConversationWithParticipants, userId: string) {
    return conversation.participants.find((item) => item.userId !== userId);
  }

  private async getOtherParticipant(conversationId: string, userId: string) {
    const conversation =
      await this.messagingRepository.findConversationWithParticipants(conversationId);
    if (!conversation) throw new NotFoundException("Cuộc trò chuyện không tồn tại");
    const participant = this.getOtherParticipantRecord(conversation, userId);
    if (!participant) throw new NotFoundException("Người nhận không tồn tại");
    return participant;
  }

  private toUserResponse(user: MessagingUserDto): MessagingUserDto {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl ?? null,
      bio: user.bio ?? null,
    };
  }

  private async messageResponseWithMedia(message: MessageRecord): Promise<MessageResponseDto> {
    const media = await this.messagingRepository.findMediaForMessages([message.id]);
    return this.toMessageResponse(message, media.get(message.id));
  }

  private toMessageResponse(
    message: MessageRecord,
    media: MessageMediaRecord[] = [],
  ): MessageResponseDto {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      clientMessageId: message.clientMessageId,
      type: message.type,
      media: message.deletedAt
        ? []
        : media.map(({ id, publicId, url, width, height, format, bytes, order }) => ({
            id,
            publicId,
            url,
            width,
            height,
            format,
            bytes,
            order,
          })),
      body: message.deletedAt ? null : message.body,
      createdAt: message.createdAt,
      editedAt: message.editedAt ?? null,
      deletedAt: message.deletedAt ?? null,
    };
  }

  private decodeConversationCursor(value?: string) {
    if (!value) return undefined;
    try {
      const decoded = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
      if (
        decoded &&
        typeof decoded.updatedAt === "string" &&
        typeof decoded.id === "string" &&
        decoded.id.length > 0
      ) {
        return {
          updatedAt: Temporal.Instant.from(decoded.updatedAt),
          id: decoded.id,
        };
      }
    } catch {
      // Cursor không hợp lệ thì bắt đầu từ trang đầu.
    }
    return undefined;
  }

  private decodeMessageCursor(value?: string) {
    if (!value) return undefined;
    try {
      const decoded = JSON.parse(Buffer.from(value, "base64").toString("utf8"));
      if (
        decoded &&
        typeof decoded.createdAt === "string" &&
        typeof decoded.id === "string" &&
        decoded.id.length > 0
      ) {
        return {
          createdAt: Temporal.Instant.from(decoded.createdAt),
          id: decoded.id,
        };
      }
    } catch {
      // Cursor không hợp lệ thì bắt đầu từ trang đầu.
    }
    return undefined;
  }

  private encodeConversationCursor(updatedAt: Temporal.Instant, id: string) {
    return Buffer.from(JSON.stringify({ updatedAt: String(updatedAt), id })).toString("base64");
  }

  private encodeMessageCursor(createdAt: Temporal.Instant, id: string) {
    return Buffer.from(JSON.stringify({ createdAt: String(createdAt), id })).toString("base64");
  }
}
