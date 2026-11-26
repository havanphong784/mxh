import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "../session";
import { Compose } from "./compose";
import { readConversations, startDirect, threadHref, unreadCount } from "./data";
import { inboxRoute } from "./model";
import { Notifications } from "./notifications";
import { Thread } from "./thread";
import { Avatar, Icon, Pager, Status, Time } from "./ui";
import { useInboxRevisions, usePages, useResource } from "./use-inbox";
import "./inbox.css";

export function Inbox({ path, user }: { path: string; user: User | null }) {
  if (!user)
    return (
      <section className="mx-inbox" lang="vi" aria-labelledby="mx-inbox-title">
        <header className="mx-inbox-title">
          <h1 id="mx-inbox-title">Hộp thư</h1>
        </header>
        <Status text="Hãy đăng nhập để xem tin nhắn và thông báo." />
        <a className="button button-primary" href="/login">
          Đăng nhập
        </a>
      </section>
    );
  return <SignedInInbox key={user.id} path={path} userId={user.id} />;
}

const loadMessageCount = (signal: AbortSignal) => unreadCount("conversations", signal);
const loadNoticeCount = (signal: AbortSignal) => unreadCount("notifications", signal);

function SignedInInbox({ path, userId }: { path: string; userId: string }) {
  const route = inboxRoute(path);
  const threadId = route.kind === "thread" ? route.id : undefined;
  const { revisions, invalidate } = useInboxRevisions(threadId);
  const messages = useResource(loadMessageCount, revisions.counts);
  const notices = useResource(loadNoticeCount, revisions.counts);
  const onThreadActivity = useCallback(
    () => invalidate({ messages: true, counts: true }),
    [invalidate],
  );
  const onNotificationRead = useCallback(
    () => invalidate({ notifications: true, counts: true }),
    [invalidate],
  );
  const isNotices = route.kind === "notifications";
  const showingDetail = route.kind === "thread" || route.kind === "compose";
  return (
    <section className="mx-inbox" lang="vi" aria-labelledby="mx-inbox-title">
      <header className="mx-inbox-title">
        <h1 id="mx-inbox-title">Hộp thư</h1>
        <button
          className="button"
          type="button"
          onClick={() =>
            invalidate({
              counts: true,
              messages: true,
              thread: true,
              notifications: true,
            })
          }
        >
          Làm mới
        </button>
      </header>
      <nav className="mx-inbox-nav" aria-label="Hộp thư">
        <a href="/messages" aria-current={!isNotices ? "page" : undefined}>
          <Icon name="message" active={!isNotices} /> Tin nhắn{" "}
          <Count count={messages.value?.count} />
        </a>
        <a href="/notifications" aria-current={isNotices ? "page" : undefined}>
          <Icon name="bell" active={isNotices} /> Thông báo <Count count={notices.value?.count} />
        </a>
      </nav>
      {(messages.failed || notices.failed) && (
        <Status text="Không thể cập nhật số chưa đọc." retry={() => invalidate({ counts: true })} />
      )}
      {isNotices ? (
        <Notifications
          revision={revisions.notifications}
          count={notices.value?.count}
          onRead={onNotificationRead}
        />
      ) : (
        <div className={`mx-inbox-grid${showingDetail ? " has-detail" : ""}`}>
          <ConversationList userId={userId} active={threadId} revision={revisions.messages} />
          {route.kind === "thread" && (
            <Thread
              key={route.id}
              id={route.id}
              userId={userId}
              revision={revisions.thread}
              onActivity={onThreadActivity}
            />
          )}
          {route.kind === "compose" &&
            (route.to ? (
              <DirectStart key={route.to} target={route.to} userId={userId} />
            ) : (
              <Compose key="new" to={null} userId={userId} />
            ))}
          {route.kind === "messages" && (
            <div className="mx-inbox-panel mx-inbox-idle">
              <Icon name="message" />
              <h2>Cuộc trò chuyện của bạn</h2>
              <p>Chọn một cuộc trò chuyện hoặc viết tin nhắn mới.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Count({ count }: { count?: number }) {
  return (
    !!count && (
      <span className="mx-inbox-count" aria-label={`${count} chưa đọc`}>
        {count > 99 ? "99+" : count}
      </span>
    )
  );
}

function ConversationList({
  userId,
  active,
  revision,
}: {
  userId: string;
  active?: string;
  revision: number;
}) {
  const conversations = usePages(readConversations, revision);
  const items = conversations.page?.items;
  return (
    <section className="mx-inbox-panel mx-inbox-list-panel" aria-labelledby="mx-inbox-list-title">
      <header className="mx-inbox-panel-head">
        <h2 id="mx-inbox-list-title">Trò chuyện</h2>
        <a href="/messages?new=1" className="button button-primary">
          <Icon name="write" /> Soạn tin
        </a>
      </header>
      {!items && !conversations.failure && <Status text="Đang tải cuộc trò chuyện…" />}
      {items?.length === 0 && <Status text="Chưa có cuộc trò chuyện. Chọn Soạn tin để bắt đầu." />}
      {items && items.length > 0 && (
        <ul className="mx-inbox-list" aria-label="Các cuộc trò chuyện">
          {items.map(({ id, participant, lastMessage, unreadCount, updatedAt }) => {
            const preview = !lastMessage
              ? "Chưa có tin nhắn"
              : lastMessage.deletedAt || lastMessage.body === null
                ? "Tin nhắn đã xóa"
                : `${lastMessage.senderId === userId ? "Bạn: " : ""}${lastMessage.body}`;
            return (
              <li key={id}>
                <a
                  href={threadHref(id)}
                  aria-current={active === id ? "page" : undefined}
                  className={`mx-inbox-row${unreadCount ? " is-unread" : ""}`}
                >
                  <Avatar person={participant} />
                  <span className="mx-inbox-person">
                    <strong>{participant.displayName || participant.username}</strong>
                    <span>{preview}</span>
                  </span>
                  <span className="mx-inbox-meta">
                    <Time value={lastMessage?.createdAt ?? updatedAt} />
                    <Count count={unreadCount} />
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <Pager {...conversations} cursor={conversations.page?.cursor} />
    </section>
  );
}

/** Profile message links start a real direct conversation, not a placeholder draft. */
function DirectStart({ target, userId }: { target: string; userId: string }) {
  const [href, setHref] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const link = useRef<HTMLAnchorElement>(null);
  const self = target === userId;

  useEffect(() => {
    if (self) return;
    const controller = new AbortController();
    void startDirect(target, controller.signal)
      .then((conversation) => {
        if (!controller.signal.aborted) setHref(threadHref(conversation.id));
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [target, self, attempt]);

  // Follow the app's normal anchor navigation, retaining a usable fallback link.
  useEffect(() => {
    if (href) link.current?.click();
  }, [href]);

  return (
    <section className="mx-inbox-panel" aria-labelledby="mx-inbox-direct-title">
      <header className="mx-inbox-panel-head">
        <a className="button mx-inbox-back" href="/messages" aria-label="Về danh sách trò chuyện">
          <Icon name="back" />
        </a>
        <h2 id="mx-inbox-direct-title">Tin nhắn mới</h2>
      </header>
      {self ? (
        <Status text="Bạn không thể nhắn tin cho chính mình." />
      ) : failed ? (
        <Status
          text="Không thể mở cuộc trò chuyện. Vui lòng thử lại."
          retry={() => {
            setFailed(false);
            setAttempt((value) => value + 1);
          }}
        />
      ) : (
        <Status text={href ? "Cuộc trò chuyện đã sẵn sàng." : "Đang mở cuộc trò chuyện…"} />
      )}
      <div className="mx-inbox-direct-actions">
        {href && (
          <a ref={link} data-replace="true" className="button button-primary" href={href}>
            Đi đến cuộc trò chuyện
          </a>
        )}
        <a className="button" href="/messages?new=1">
          Chọn người nhận khác
        </a>
      </div>
    </section>
  );
}
