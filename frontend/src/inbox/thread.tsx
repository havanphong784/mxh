import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { FormEvent } from "react";
import {
  markThreadRead,
  readConversation,
  readThread,
  sendMessage,
} from "./data";
import { mergeById, messageDraft } from "./model";
import type { MessageDraft } from "./model";
import { usePages, useResource, useWrite } from "./use-inbox";
import { Avatar, Icon, Pager, Status, Time } from "./ui";

export function Thread({
  id,
  userId,
  revision,
  onActivity,
}: {
  id: string;
  userId: string;
  revision: number;
  onActivity: () => void;
}) {
  const load = useCallback(
    (cursor: string | null, signal: AbortSignal) =>
      readThread(id, cursor, signal),
    [id],
  );
  const loadConversation = useCallback(
    (signal: AbortSignal) => readConversation(id, signal),
    [id],
  );
  const history = usePages(load, revision, true);
  const conversation = useResource(loadConversation, revision);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const pendingDraft = useRef<MessageDraft | null>(null);
  const write = useWrite();
  const read = useWrite();
  const log = useRef<HTMLDivElement>(null);
  const offset = useRef<{ height: number; top: number } | null>(null);
  const [atEnd, setAtEnd] = useState(true);
  const [visible, setVisible] = useState(
    () => document.visibilityState !== "hidden",
  );
  const [lastRead, setLastRead] = useState<string | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const messages = history.page?.items;
  const peer = conversation.value?.participant;
  // The read endpoint marks through server time; only call it when the newest
  // loaded message is visible and the document is not in a background tab.
  const latest = messages?.at(-1);
  const readKey =
    latest && (latest.senderId !== userId || !!conversation.value?.unreadCount)
      ? latest.id
      : undefined;

  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  useEffect(() => {
    if (
      !atEnd ||
      !visible ||
      !readKey ||
      lastRead === readKey ||
      readFailed ||
      history.busy ||
      history.failure
    )
      return;
    void read(
      (signal) => markThreadRead(id, signal),
      () => {
        setLastRead(readKey);
        onActivity();
      },
      () => setReadFailed(true),
    );
  }, [
    id,
    atEnd,
    visible,
    readKey,
    lastRead,
    readFailed,
    history.busy,
    history.failure,
    onActivity,
    read,
  ]);

  useLayoutEffect(() => {
    const element = log.current;
    if (!element) return;
    if (offset.current) {
      const { height, top } = offset.current;
      element.scrollTop = top + element.scrollHeight - height;
      offset.current = null;
    } else if (atEnd) {
      element.scrollTop = element.scrollHeight;
    }
  }, [messages, atEnd]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const request = messageDraft(draft, pendingDraft.current, () => {
      const bytes = crypto.getRandomValues(new Uint8Array(16));
      return Array.from(bytes, (value) =>
        value.toString(16).padStart(2, "0"),
      ).join("");
    });
    if (!request) return;
    pendingDraft.current = request;
    setSending(true);
    setSendFailed(false);
    void write(
      (signal) => sendMessage(id, request, signal),
      (message) => {
        pendingDraft.current = null;
        offset.current = null;
        setAtEnd(true);
        history.update((items) =>
          items.some((item) => item.id === message.id)
            ? items
            : mergeById(items, [message]),
        );
        history.reload();
        setDraft("");
        setSending(false);
        onActivity();
      },
      () => {
        setSending(false);
        setSendFailed(true);
      },
    );
  }

  function loadOlder() {
    if (log.current)
      offset.current = {
        height: log.current.scrollHeight,
        top: log.current.scrollTop,
      };
    history.more();
  }

  return (
    <section
      className="mx-inbox-panel mx-inbox-thread"
      aria-label="Cuộc trò chuyện"
    >
      <header className="mx-inbox-panel-head mx-inbox-thread-head">
        <a
          className="button mx-inbox-back"
          href="/messages"
          aria-label="Về danh sách trò chuyện"
        >
          <Icon name="back" />
        </a>
        {peer && <Avatar person={peer} />}
        <div className="mx-inbox-person">
          <h2>{peer?.displayName || peer?.username || "Cuộc trò chuyện"}</h2>
          {peer && <p>@{peer.username}</p>}
        </div>
      </header>
      {conversation.failed && (
        <Status
          text="Không thể tải thông tin cuộc trò chuyện."
          retry={conversation.reload}
        />
      )}
      <div
        ref={log}
        className="mx-inbox-log"
        onScroll={(event) => {
          const element = event.currentTarget;
          setAtEnd(
            element.scrollHeight - element.scrollTop - element.clientHeight <
              48,
          );
        }}
      >
        <Pager
          {...history}
          cursor={history.page?.cursor}
          more={loadOlder}
          label="Tải tin nhắn cũ hơn"
          root={log.current}
          rootMargin="320px 0px 0px 0px"
        />
        {!messages && !history.failure && <Status text="Đang tải tin nhắn…" />}
        {messages?.length === 0 && (
          <Status text="Chưa có tin nhắn. Hãy gửi lời chào!" />
        )}
        {messages && messages.length > 0 && (
          <ol className="mx-inbox-bubbles" aria-label="Tin nhắn">
            {messages.map((message) => (
              <li
                key={message.id}
                className={message.senderId === userId ? "is-mine" : ""}
              >
                <span className="mx-inbox-sr">
                  {message.senderId === userId
                    ? "Bạn: "
                    : `${peer?.displayName || "Người nhận"}: `}
                </span>
                <p>
                  {message.deletedAt || message.body === null ? (
                    <em>Tin nhắn đã xóa</em>
                  ) : (
                    message.body
                  )}
                </p>
                <Time value={message.createdAt} />
              </li>
            ))}
          </ol>
        )}
      </div>
      {!atEnd && (
        <div className="mx-inbox-pager">
          <button
            className="button"
            type="button"
            onClick={() => {
              if (log.current) log.current.scrollTop = log.current.scrollHeight;
              setAtEnd(true);
            }}
          >
            Đến tin nhắn mới nhất
          </button>
        </div>
      )}
      {readFailed && (
        <Status
          text="Không thể đánh dấu đã đọc."
          retry={() => setReadFailed(false)}
        />
      )}
      {history.page && peer && (
        <form className="mx-inbox-form mx-inbox-reply" onSubmit={submit}>
          <label htmlFor="mx-inbox-draft">Tin nhắn</label>
          <textarea
            id="mx-inbox-draft"
            placeholder="Viết tin nhắn…"
            rows={2}
            maxLength={2000}
            value={draft}
            readOnly={sending}
            onChange={(event) => {
              setDraft(event.target.value);
              setSendFailed(false);
            }}
          />
          <button
            type="submit"
            className="button button-primary"
            disabled={sending || !draft.trim()}
          >
            <Icon name="send" /> {sending ? "Đang gửi…" : "Gửi"}
          </button>
          {sendFailed && (
            <p className="mx-inbox-error" role="alert">
              Không thể gửi tin nhắn. Tin nhắn vẫn ở ô soạn; hãy thử gửi lại.
            </p>
          )}
        </form>
      )}
    </section>
  );
}
