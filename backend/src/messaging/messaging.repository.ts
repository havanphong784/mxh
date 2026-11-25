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
      .where((user) => user.isActive.eq(true))
      .where((user) => user.isEmailVerified.eq(true))
      .first();
  }

  async findDirectConversation(directKey: string) {
    return this.conversation.where({ directKey }).first();
  }

  async createDirectConversation(directKey: string, userIds: string[]) {
    return this.prisma.client.transaction(async (tx) => {
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
    const participant = await this.participant.where({ conversationId, userId }).first();
    if (!participant) return null;

    const conversation = await this.findConversationWithParticipants(conversationId);
    if (!conversation) return null;

    return { conversation, participant };
  }

  async findConversationWithParticipants(conversationId: string) {
    return this.conversation
      .where({ id: conversationId })
      .include("participants", (query) => query.include("user"))
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
        conversation.participants.some((participant) => participant.userId.eq(userId)),
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

  async findLatestMessage(conversationId: string): Promise<MessageRecord | null> {
    const messages = await this.message
      .where({ conversationId })
      .orderBy([(item) => item.createdAt.desc(), (item) => item.id.desc()])
      .limit(1)
      .all();
    return messages[0] ?? null;
  }

  async findLatestMessages(conversationIds: string[]) {
    if (conversationIds.length === 0) return [];
    const plan = this.prisma.client.raw.sql`
      SELECT DISTINCT ON ("conversationId")
        id, "conversationId", "senderId", "clientMessageId", type, body,
        "createdAt", "editedAt", "deletedAt"
      FROM "message"
      WHERE "conversationId" = ANY(string_to_array(${conversationIds.join(",")}, ','))
      ORDER BY "conversationId", "createdAt" DESC, id DESC
    `
      .returnsRow({
        id: "pg/text@1",
        conversationId: "pg/text@1",
        senderId: "pg/text@1",
        clientMessageId: "pg/text@1",
        type: "pg/text@1",
        body: "pg/text@1",
        createdAt: "pg/timestamptz-temporal@1",
        editedAt: "pg/timestamptz-temporal@1",
        deletedAt: "pg/timestamptz-temporal@1",
      })
      .build();
    return this.prisma.client.runtime().query(plan);
  }

  async countUnreadForConversations(conversationIds: string[], userId: string) {
    if (conversationIds.length === 0) return new Map<string, number>();
    const plan = this.prisma.client.raw.sql`
      SELECT p."conversationId", COUNT(m.id)::int AS count
      FROM "conversationParticipant" p
      LEFT JOIN "message" m
        ON m."conversationId" = p."conversationId"
       AND m."senderId" <> p."userId"
       AND (p."lastReadAt" IS NULL OR m."createdAt" > p."lastReadAt")
      WHERE p."userId" = ${userId}
        AND p."conversationId" = ANY(string_to_array(${conversationIds.join(",")}, ','))
      GROUP BY p."conversationId"
    `
      .returnsRow({ conversationId: "pg/text@1", count: "pg/int4@1" })
      .build();
    const rows = await this.prisma.client.runtime().query(plan);
    return new Map(rows.map((row: any) => [row.conversationId, Number(row.count)]));
  }

  async countAllUnreadForUser(userId: string): Promise<number> {
    const plan = this.prisma.client.raw.sql`
      SELECT COUNT(m.id)::int AS count
      FROM "conversationParticipant" p
      LEFT JOIN "message" m
        ON m."conversationId" = p."conversationId"
       AND m."senderId" <> p."userId"
       AND (p."lastReadAt" IS NULL OR m."createdAt" > p."lastReadAt")
      WHERE p."userId" = ${userId}
    `
      .returnsRow({ count: "pg/int4@1" })
      .build();
    const [row] = await this.prisma.client.runtime().query(plan);
    return Number(row?.count ?? 0);
  }

  async listMessages(
    conversationId: string,
    limit: number,
    cursor?: { createdAt: Temporal.Instant; id: string },
  ) {
    let query = this.message
      .where({ conversationId })
      .orderBy([(item) => item.createdAt.desc(), (item) => item.id.desc()]);

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
    return this.prisma.client.transaction(async (tx) => {
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
        message: created,
        created: true,
      };
    });
  }

  async markAsRead(conversationId: string, userId: string, readAt: Temporal.Instant) {
    await this.participant.where({ conversationId, userId }).update({
      lastReadAt: readAt,
    });
  }

  async countUnreadForConversation(
    conversationId: string,
    userId: string,
    lastReadAt: Temporal.Instant | null,
  ): Promise<number> {
    let query = this.message.where({ conversationId }).where((item) => item.senderId.neq(userId));

    if (lastReadAt) {
      query = query.where((item) => item.createdAt.gt(lastReadAt));
    }

    const result = await query.aggregate((item) => ({
      count: item.count(),
    }));
    return Number(result.count) || 0;
  }

  async findUnreadParticipants(userId: string) {
    return this.listParticipantsForUser(userId);
  }
}

export type ConversationWithParticipants = NonNullable<
  Awaited<ReturnType<MessagingRepository["findConversationWithParticipants"]>>
>;

export type ConversationParticipantRecord = NonNullable<
  Awaited<ReturnType<MessagingRepository["findParticipant"]>>
>;

export type MessageRecord = NonNullable<
  Awaited<ReturnType<MessagingRepository["findMessageByClientId"]>>
>;
