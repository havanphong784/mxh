import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Temporal } from "@js-temporal/polyfill";
import { EventsGateway } from "../gateway/events.gateway.js";
import { MESSAGE_EVENTS } from "../events/event-types.js";
import { MessagingRepository } from "./messaging.repository.js";
import type {
  ConversationParticipantRecord,
  ConversationWithParticipants,
  MessageRecord,
} from "./messaging.repository.js";
import { ConversationPaginationDto } from "./dto/conversation-pagination.dto.js";
import { CreateDirectConversationDto } from "./dto/create-direct-conversation.dto.js";
import { SendMessageDto } from "./dto/send-message.dto.js";
import type {
  ConversationPageDto,
  ConversationResponseDto,
  MarkConversationReadDto,
  MessagePageDto,
  MessageResponseDto,
  MessagingUserDto,
  UnreadMessagesCountDto,
} from "./dto/messaging-response.dto.js";

@Injectable()
export class MessagingService {
  constructor(
    private readonly messagingRepository: MessagingRepository,
    private readonly eventsGateway: EventsGateway,
  ) {}

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
      throw new NotFoundException(
        "Người dùng không tồn tại hoặc không còn hoạt động",
      );
    }

    const directKey = [userId, dto.targetUserId].sort().join(":");
    let conversation =
      await this.messagingRepository.findDirectConversation(directKey);

    if (!conversation) {
      try {
        conversation = await this.messagingRepository.createDirectConversation(
          directKey,
          [userId, dto.targetUserId],
        );
      } catch {
        conversation =
          await this.messagingRepository.findDirectConversation(directKey);
        if (!conversation)
          throw new ConflictException("Không thể tạo cuộc trò chuyện");
      }
    }

    if (!conversation) {
      throw new ConflictException("Không thể tạo cuộc trò chuyện");
    }

    const result = await this.messagingRepository.findConversationForUser(
      conversation.id,
      userId,
    );
    if (!result) throw new NotFoundException("Cuộc trò chuyện không tồn tại");

    return this.toConversationResponse(
      result.conversation,
      result.participant,
      userId,
    );
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
    const data = await Promise.all(
      items.map((conversation) => {
        const participant = conversation.participants.find(
          (item) => item.userId === userId,
        );
        return this.toConversationResponse(conversation, participant, userId);
      }),
    );
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? this.encodeConversationCursor(last.updatedAt, last.id)
        : null;

    return {
      data,
      nextCursor,
      hasMore,
    };
  }

  async getConversation(
    userId: string,
    conversationId: string,
  ): Promise<ConversationResponseDto> {
    const result = await this.messagingRepository.findConversationForUser(
      conversationId,
      userId,
    );
    if (!result)
      throw new NotFoundException(
        "Cuộc trò chuyện không tồn tại hoặc bạn không có quyền xem",
      );
    return this.toConversationResponse(
      result.conversation,
      result.participant,
      userId,
    );
  }

  async getMessages(
    userId: string,
    conversationId: string,
    query: ConversationPaginationDto,
  ): Promise<MessagePageDto> {
    const participant = await this.messagingRepository.findParticipant(
      conversationId,
      userId,
    );
    if (!participant) {
      throw new ForbiddenException(
        "Bạn không có quyền xem cuộc trò chuyện này",
      );
    }

    const limit = Math.min(50, Math.max(1, Number(query.limit) || 30));
    const cursor = this.decodeMessageCursor(query.cursor);
    const result = await this.messagingRepository.listMessages(
      conversationId,
      limit,
      cursor,
    );
    const data = result.items.map((message) => this.toMessageResponse(message));
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
    const participant = await this.messagingRepository.findParticipant(
      conversationId,
      userId,
    );
    if (!participant) {
      throw new ForbiddenException(
        "Bạn không có quyền gửi tin nhắn vào cuộc trò chuyện này",
      );
    }

    const body = dto.body.trim();
    if (!body) throw new BadRequestException("Tin nhắn không được để trống");

    const existing = await this.messagingRepository.findMessageByClientId(
      userId,
      dto.clientMessageId,
    );
    if (existing) {
      if (existing.conversationId !== conversationId) {
        throw new ConflictException(
          "clientMessageId đã được sử dụng cho tin nhắn khác",
        );
      }
      return this.toMessageResponse(existing);
    }

    let message: MessageRecord;
    let created = false;
    try {
      const result = await this.messagingRepository.createMessage({
        conversationId,
        senderId: userId,
        clientMessageId: dto.clientMessageId,
        body,
      });
      message = result.message;
      created = result.created;
    } catch {
      const retried = await this.messagingRepository.findMessageByClientId(
        userId,
        dto.clientMessageId,
      );
      if (!retried || retried.conversationId !== conversationId) {
        throw new ConflictException("Không thể gửi tin nhắn, vui lòng thử lại");
      }
      message = retried;
    }

    const response = this.toMessageResponse(message);
    if (!created) return response;

    const recipient = await this.getOtherParticipant(conversationId, userId);
    const event = {
      conversationId,
      message: response,
      senderId: userId,
      recipientId: recipient.userId,
    };

    this.eventsGateway.pushToUser(userId, MESSAGE_EVENTS.NEW_MESSAGE, event);
    this.eventsGateway.pushToUser(
      recipient.userId,
      MESSAGE_EVENTS.NEW_MESSAGE,
      event,
    );

    const recipientUnreadCount =
      await this.messagingRepository.countUnreadForConversation(
        conversationId,
        recipient.userId,
        recipient.lastReadAt ?? null,
      );
    this.eventsGateway.pushToUser(
      recipient.userId,
      MESSAGE_EVENTS.UNREAD_COUNT,
      {
        count: await this.getUnreadCountValue(
          recipient.userId,
          recipientUnreadCount,
          conversationId,
        ),
      },
    );

    return response;
  }

  async markConversationRead(
    userId: string,
    conversationId: string,
  ): Promise<MarkConversationReadDto> {
    const participant = await this.messagingRepository.findParticipant(
      conversationId,
      userId,
    );
    if (!participant) {
      throw new ForbiddenException(
        "Bạn không có quyền cập nhật cuộc trò chuyện này",
      );
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

  private async getUnreadCountValue(
    userId: string,
    knownConversationCount?: number,
    knownConversationId?: string,
  ): Promise<number> {
    const participants =
      await this.messagingRepository.findUnreadParticipants(userId);
    let total = 0;

    for (const participant of participants) {
      if (
        participant.conversationId === knownConversationId &&
        knownConversationCount !== undefined
      ) {
        total += knownConversationCount;
        continue;
      }
      total += await this.messagingRepository.countUnreadForConversation(
        participant.conversationId,
        userId,
        participant.lastReadAt ?? null,
      );
    }

    return total;
  }

  private async toConversationResponse(
    conversation: ConversationWithParticipants,
    participant: ConversationParticipantRecord | undefined,
    userId: string,
  ): Promise<ConversationResponseDto> {
    const participantRecord = this.getOtherParticipantRecord(
      conversation,
      userId,
    );
    if (!participantRecord?.user || !participant) {
      throw new NotFoundException(
        "Người tham gia cuộc trò chuyện không tồn tại",
      );
    }

    const [lastMessage, unreadCount] = await Promise.all([
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
      lastMessage: lastMessage ? this.toMessageResponse(lastMessage) : null,
      unreadCount,
      updatedAt: conversation.updatedAt,
    };
  }

  private getOtherParticipantRecord(
    conversation: ConversationWithParticipants,
    userId: string,
  ) {
    return conversation.participants.find((item) => item.userId !== userId);
  }

  private async getOtherParticipant(conversationId: string, userId: string) {
    const conversation =
      await this.messagingRepository.findConversationWithParticipants(
        conversationId,
      );
    if (!conversation)
      throw new NotFoundException("Cuộc trò chuyện không tồn tại");
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

  private toMessageResponse(message: MessageRecord): MessageResponseDto {
    return {
      id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      clientMessageId: message.clientMessageId,
      type: "TEXT",
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
    return Buffer.from(
      JSON.stringify({ updatedAt: String(updatedAt), id }),
    ).toString("base64");
  }

  private encodeMessageCursor(createdAt: Temporal.Instant, id: string) {
    return Buffer.from(
      JSON.stringify({ createdAt: String(createdAt), id }),
    ).toString("base64");
  }
}
