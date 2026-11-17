import type { Temporal } from "@js-temporal/polyfill";

export interface MessagingUserDto {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
}

export interface MessageResponseDto {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  type: "TEXT";
  body: string | null;
  createdAt: Temporal.Instant;
  editedAt: Temporal.Instant | null;
  deletedAt: Temporal.Instant | null;
}

export interface ConversationResponseDto {
  id: string;
  type: "DIRECT";
  participant: MessagingUserDto;
  lastMessage: MessageResponseDto | null;
  unreadCount: number;
  updatedAt: Temporal.Instant;
}

export interface ConversationPageDto {
  data: ConversationResponseDto[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface MessagePageDto {
  data: MessageResponseDto[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface UnreadMessagesCountDto {
  count: number;
}

export interface MarkConversationReadDto {
  success: true;
  conversationId: string;
  unreadCount: number;
}
