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
  createdAt: unknown;
  editedAt: unknown | null;
  deletedAt: unknown | null;
}

export interface ConversationResponseDto {
  id: string;
  type: "DIRECT";
  participant: MessagingUserDto;
  lastMessage: MessageResponseDto | null;
  unreadCount: number;
  updatedAt: unknown;
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
