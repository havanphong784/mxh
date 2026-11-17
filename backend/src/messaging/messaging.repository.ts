import { Injectable } from "@nestjs/common";
import { Temporal } from "@js-temporal/polyfill";
import { PrismaService } from "../prisma/prisma.service.js";

@Injectable()
export class MessagingRepository {
  constructor(private readonly prisma: PrismaService) {}

  get conversation() {
    return this.prisma.client.orm.public.Conversation;
  }

  get participant() {
    return this.prisma.client.orm.public.ConversationParticipant;
  }

  get message() {
    return this.prisma.client.orm.public.Message;
  }

  get user() {
    return this.prisma.client.orm.public.User;
  }

  async findActiveUser(userId: string) {
    return this.user
      .where({ id: userId })
      .where((user: any) => user.isActive.eq(true))
      .where((user: any) => user.isEmailVerified.eq(true))
      .first();
  }

  async findDirectConversation(directKey: string) {
    return this.conversation.where({ directKey }).first();
  }

  async createDirectConversation(directKey: string, userIds: string[]) {
    return this.prisma.client.transaction(async (tx: any) => {
      const conversation = await tx.orm.public.Conversation.create({
        directKey,
        type: "DIRECT",
      });

      for (const userId of userIds) {
        await tx.orm.public.ConversationParticipant.create({
          conversationId: conversation.id,
          userId,
        });
      }

      return conversation;
    });
  }

  async findConversationForUser(conversationId: string, userId: string) {
    const participant = await this.participant
      .where({ conversationId, userId })
      .first();
    if (!participant) return null;

    const conversation =
      await this.findConversationWithParticipants(conversationId);
    if (!conversation) return null;

    return { conversation, participant };
  }

  async findConversationWithParticipants(conversationId: string) {
    return this.conversation
      .where({ id: conversationId })
      .include("participants", (query: any) => query.include("user"))
      .first();
  }

  async listParticipantsForUser(userId: string) {
    return this.participant.where({ userId }).all();
  }

  async listConversations(
    userId: string,
    limit: number,
    cursor?: { updatedAt: Temporal.Instant; id: string },
  ) {
    let query = this.conversation
      .where((conversation) =>
        conversation.participants.some((participant) =>
          participant.userId.eq(userId),
        ),
      )
      .orderBy([(item) => item.updatedAt.desc(), (item) => item.id.desc()]);

    if (cursor) query = query.cursor(cursor);

    const conversations = await query
      .include("participants", (participant) => participant.include("user"))
      .limit(limit + 1)
      .all();
    return {
      items: conversations.slice(0, limit),
      hasMore: conversations.length > limit,
    };
  }

  async findParticipant(conversationId: string, userId: string) {
    return this.participant.where({ conversationId, userId }).first();
  }

  async findLatestMessage(conversationId: string) {
    const messages = await this.message
      .where({ conversationId })
      .orderBy([
        (item: any) => item.createdAt.desc(),
        (item: any) => item.id.desc(),
      ])
      .limit(1)
      .all();
    return messages[0] ?? null;
  }

  async listMessages(
    conversationId: string,
    limit: number,
    cursor?: { createdAt: Temporal.Instant; id: string },
  ) {
    let query = this.message
      .where({ conversationId })
      .orderBy([
        (item: any) => item.createdAt.desc(),
        (item: any) => item.id.desc(),
      ]);

    if (cursor) query = query.cursor(cursor);

    const messages = await query.limit(limit + 1).all();
    const hasMore = messages.length > limit;
    const page = hasMore ? messages.slice(0, limit) : messages;

    return {
      items: page.reverse(),
      hasMore,
    };
  }

  async findMessageByClientId(senderId: string, clientMessageId: string) {
    return this.message.where({ senderId, clientMessageId }).first();
  }

  async createMessage(data: {
    conversationId: string;
    senderId: string;
    clientMessageId: string;
    body: string;
  }) {
    return this.prisma.client.transaction(async (tx: any) => {
      const existing = await tx.orm.public.Message.where({
        senderId: data.senderId,
        clientMessageId: data.clientMessageId,
      }).first();
      if (existing) return { message: existing, created: false };

      const created = await tx.orm.public.Message.create({
        conversationId: data.conversationId,
        senderId: data.senderId,
        clientMessageId: data.clientMessageId,
        type: "TEXT",
        body: data.body,
      });

      await tx.orm.public.Conversation.where({
        id: data.conversationId,
      }).update({
        updatedAt: Temporal.Now.instant(),
      });

      return {
        message: await tx.orm.public.Message.where({ id: created.id }).first(),
        created: true,
      };
    });
  }

  async markAsRead(
    conversationId: string,
    userId: string,
    readAt: Temporal.Instant,
  ) {
    await this.participant.where({ conversationId, userId }).update({
      lastReadAt: readAt,
    });
  }

  async countUnreadForConversation(
    conversationId: string,
    userId: string,
    lastReadAt: Temporal.Instant | null,
  ): Promise<number> {
    let query = this.message
      .where({ conversationId })
      .where((item: any) => item.senderId.neq(userId));

    if (lastReadAt) {
      query = query.where((item: any) => item.createdAt.gt(lastReadAt));
    }

    const result = await query.aggregate((item: any) => ({
      count: item.count(),
    }));
    return Number(result.count) || 0;
  }

  async findUnreadParticipants(userId: string) {
    return this.listParticipantsForUser(userId);
  }
}
