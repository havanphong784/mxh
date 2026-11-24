import { api } from "../api";
import type { User } from "../session";
import { pagePath } from "./model";
import type { MessageDraft, Page } from "./model";

type Person = User & { bio?: string | null };
export type Message = {
  id: string;
  conversationId: string;
  senderId: string;
  clientMessageId: string;
  type: "TEXT";
  body: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
};
export type Conversation = {
  id: string;
  type: "DIRECT";
  participant: Person;
  lastMessage: Message | null;
  unreadCount: number;
  updatedAt: string;
};
export type Notice = {
  id: string;
  type: "LIKE" | "REPLY" | "REPOST" | "QUOTE" | "FOLLOW";
  isRead: boolean;
  createdAt: string;
  actor: Person | null;
  post: { id: string; content: string | null } | null;
};

type Collection<T> = { data: T[]; nextCursor: string | null; hasMore: boolean };
async function collection<T>(
  path: string,
  cursor: string | null,
  signal: AbortSignal,
): Promise<Page<T>> {
  const page = await api<Collection<T>>(pagePath(path, cursor), {
    auth: true,
    signal,
  });
  return { items: page.data, cursor: page.hasMore ? page.nextCursor : null };
}

export const threadHref = (id: string) => `/messages/${encodeURIComponent(id)}`;
const conversationPath = (id: string) => `/conversations/${encodeURIComponent(id)}`;
export const readConversations = (cursor: string | null, signal: AbortSignal) =>
  collection<Conversation>("/conversations", cursor, signal);
export const readNotices = (cursor: string | null, signal: AbortSignal) =>
  collection<Notice>("/notifications", cursor, signal);
export const readThread = (id: string, cursor: string | null, signal: AbortSignal) =>
  collection<Message>(`${conversationPath(id)}/messages`, cursor, signal);
export const readConversation = (id: string, signal: AbortSignal) =>
  api<Conversation>(conversationPath(id), { auth: true, signal });
export const unreadCount = (kind: "conversations" | "notifications", signal: AbortSignal) =>
  api<{ count: number }>(`/${kind}/unread-count`, { auth: true, signal });
export const startDirect = (targetUserId: string, signal: AbortSignal) =>
  api<Conversation>("/conversations/direct", {
    method: "POST",
    auth: true,
    body: { targetUserId },
    signal,
  });
export const sendMessage = (id: string, body: MessageDraft, signal: AbortSignal) =>
  api<Message>(`${conversationPath(id)}/messages`, {
    method: "POST",
    auth: true,
    body,
    signal,
  });
export const markThreadRead = (id: string, signal: AbortSignal) =>
  api<{ success: true; conversationId: string; unreadCount: number }>(
    `${conversationPath(id)}/read`,
    { method: "POST", auth: true, signal },
  );
export const markNoticeRead = (id: string, signal: AbortSignal) =>
  api<{ success: boolean; id: string }>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: "PATCH",
    auth: true,
    signal,
  });
export const markAllNoticesRead = (signal: AbortSignal) =>
  api<{ success: boolean; count: number }>("/notifications/read-all", {
    method: "POST",
    auth: true,
    signal,
  });
export async function searchPeople(
  query: string,
  cursor: string | null,
  signal: AbortSignal,
): Promise<Page<Person>> {
  const page = await api<{ items: Person[]; nextCursor: string | null }>(
    pagePath("/users/search", cursor, query),
    { auth: true, signal },
  );
  return { items: page.items, cursor: page.nextCursor };
}
