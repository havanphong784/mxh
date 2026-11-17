import type { InfiniteData } from "@tanstack/react-query";
import type { ConversationItem, MessageItem, MessagingPage } from "@/types/api";

export type ConversationData = InfiniteData<MessagingPage<ConversationItem>>;
export type MessageData = InfiniteData<MessagingPage<MessageItem>>;

function sortMessages(items: MessageItem[]) {
  return [...items].sort((a, b) => {
    const byTime =
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return byTime || a.id.localeCompare(b.id);
  });
}

function isSameMessage(a: MessageItem, b: MessageItem) {
  return (
    a.id === b.id ||
    (a.senderId === b.senderId && a.clientMessageId === b.clientMessageId)
  );
}

export function upsertMessage(
  cached: MessageData | undefined,
  message: MessageItem,
): MessageData | undefined {
  if (!cached) {
    return {
      pages: [{ data: [message], nextCursor: null, hasMore: false }],
      pageParams: [null],
    };
  }
  const pages = cached.pages.map((page) => ({
    ...page,
    data: page.data.filter((item) => !isSameMessage(item, message)),
  }));
  const firstPage = pages[0];
  if (!firstPage) return { ...cached, pages };
  pages[0] = {
    ...firstPage,
    data: sortMessages([...firstPage.data, message]),
  };
  return { ...cached, pages };
}

export function replaceMessage(
  cached: MessageData | undefined,
  clientMessageId: string,
  message: MessageItem,
): MessageData | undefined {
  if (!cached) return cached;
  let replaced = false;
  const pages = cached.pages.map((page) => ({
    ...page,
    data: page.data.map((item) => {
      if (
        item.clientMessageId !== clientMessageId ||
        (item.senderId !== message.senderId && !item.id.startsWith("local:"))
      ) {
        return item;
      }
      replaced = true;
      return message;
    }),
  }));
  if (!replaced) return upsertMessage(cached, message);
  return { ...cached, pages };
}

export function updateConversation(
  cached: ConversationData | undefined,
  conversationId: string,
  updater: (conversation: ConversationItem) => ConversationItem,
): ConversationData | undefined {
  if (!cached) return cached;
  return {
    ...cached,
    pages: cached.pages.map((page) => ({
      ...page,
      data: page.data.map((conversation) =>
        conversation.id === conversationId
          ? updater(conversation)
          : conversation,
      ),
    })),
  };
}

export function upsertConversation(
  cached: ConversationData | undefined,
  conversation: ConversationItem,
): ConversationData | undefined {
  if (!cached) {
    return {
      pages: [{ data: [conversation], nextCursor: null, hasMore: false }],
      pageParams: [null],
    };
  }
  const pages = cached.pages.map((page) => ({
    ...page,
    data: page.data.filter((item) => item.id !== conversation.id),
  }));
  if (!pages[0]) return cached;
  pages[0] = { ...pages[0], data: [conversation, ...pages[0].data] };
  return { ...cached, pages };
}
