import type { MessageMediaInput } from "./media.ts";

export type InboxRoute =
  | { kind: "messages" }
  | { kind: "thread"; id: string }
  | { kind: "compose"; to: string | null }
  | { kind: "notifications" };

export function inboxRoute(path: string): InboxRoute {
  const url = new URL(path, "https://inbox.invalid");
  const pathname = url.pathname.replace(/\/$/, "");
  if (pathname === "/notifications") return { kind: "notifications" };
  if (pathname === "/messages") {
    const to = url.searchParams.get("to")?.trim() || null;
    if (to || url.searchParams.get("new") === "1") return { kind: "compose", to };
  }
  const match = /^\/messages\/([^/]+)$/.exec(pathname);
  if (match) {
    try {
      return { kind: "thread", id: decodeURIComponent(match[1]) };
    } catch {
      /* Invalid URL */
    }
  }
  return { kind: "messages" };
}

export function pagePath(base: string, cursor: string | null, query?: string) {
  const params = new URLSearchParams({ limit: "20" });
  if (cursor) params.set("cursor", cursor);
  if (query) params.set("q", query);
  return `${base}?${params}`;
}

type Identified = { id: string };
export type Page<T> = { items: T[]; cursor: string | null };
export type WindowPage<T> = Page<T> & { depth: number };

/** Keep each ID's first position and its most recently supplied value. */
export function mergeById<T extends Identified>(first: T[], second: T[]) {
  return [...new Map([...first, ...second].map((item) => [item.id, item])).values()];
}

export async function readWindow<T extends Identified>(
  read: (cursor: string | null) => Promise<Page<T>>,
  depth: number,
  prepend = false,
): Promise<WindowPage<T>> {
  let result: WindowPage<T> = { items: [], cursor: null, depth: 0 };
  do {
    const page = await read(result.cursor);
    result = {
      items: prepend ? mergeById(page.items, result.items) : mergeById(result.items, page.items),
      cursor: page.cursor,
      depth: result.depth + 1,
    };
  } while (result.cursor && result.depth < depth);
  return result;
}

export type MessageDraft = { body: string; clientMessageId: string; media?: MessageMediaInput[] };

export function messageDraft(
  input: string,
  previous: MessageDraft | null,
  makeId: () => string,
  media: MessageMediaInput[] = [],
): MessageDraft | null {
  const body = input.trim();
  if ((!body && !media.length) || body.length > 2000) return null;
  const sameMedia = JSON.stringify(previous?.media ?? []) === JSON.stringify(media);
  return previous?.body === body && sameMedia
    ? previous
    : { body, clientMessageId: makeId(), ...(media.length ? { media } : {}) };
}

export function realtimeImpact(event: string, data: unknown, threadId?: string) {
  const current =
    !!threadId &&
    typeof data === "object" &&
    data !== null &&
    "conversationId" in data &&
    data.conversationId === threadId;
  const connected = event === "connect";
  const messages =
    connected || event === "conversation:new-message" || event === "conversation:read";
  const notifications =
    connected || event === "notification:new" || event === "notification:unread-count";
  if (!messages && !notifications && event !== "conversation:unread-count") return null;
  return {
    counts: true,
    messages,
    thread: connected || (event === "conversation:new-message" && current),
    notifications,
  };
}
