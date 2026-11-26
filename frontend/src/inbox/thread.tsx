import type { FormEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { markThreadRead, readConversation, readThread, sendMessage } from "./data";
import type { MessageMediaInput } from "./media";
import { MessageMedia } from "./message-media";
import type { MessageDraft } from "./model";
import { mergeById, messageDraft } from "./model";
import { Avatar, Icon, Pager, Status, Time } from "./ui";
import { usePages, useResource, useWrite } from "./use-inbox";
import { useMessageMedia } from "./use-message-media";
import { useTyping } from "./use-typing";

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
    (cursor: string | null, signal: AbortSignal) => readThread(id, cursor, signal),
    [id],
  );
  const loadConversation = useCallback((signal: AbortSignal) => readConversation(id, signal), [id]);
  const history = usePages(load, revision, true);
  const conversation = useResource(loadConversation, revision);
  const draftKey = `mxh:draft:message:${userId}:${id}`;
  const [draft, setDraft] = useState(() => {
    try {
      return sessionStorage.getItem(draftKey) ?? "";
    } catch {
      return "";
    }
  });
  const attachments = useMessageMedia(id);
  const sendingLock = useRef(false);
  const [sending, setSending] = useState(false);
  const [sendFailed, setSendFailed] = useState(false);
  const [sendError, setSendError] = useState("");
  const pendingDraft = useRef<MessageDraft | null>(null);
  const write = useWrite();
  const read = useWrite();
  const log = useRef<HTMLDivElement>(null);
  const offset = useRef<{ height: number; top: number } | null>(null);
  const [atEnd, setAtEnd] = useState(true);
  const [visible, setVisible] = useState(() => document.visibilityState !== "hidden");
  const [lastRead, setLastRead] = useState<string | null>(null);
  const [readFailed, setReadFailed] = useState(false);
  const messages = history.page?.items;
  const peer = conversation.value?.participant;
  const typing = useTyping(id, userId, peer?.id);
  // The read endpoint marks through server time; only call it when the newest
  // loaded message is visible and the document is not in a background tab.
  const latest = messages?.at(-1);
  const readKey =
    latest && (latest.senderId !== userId || !!conversation.value?.unreadCount)
      ? latest.id
      : undefined;

  useEffect(() => {
    try {
      if (draft) sessionStorage.setItem(draftKey, draft);
      else sessionStorage.removeItem(draftKey);
    } catch {
      // Draft persistence is best effort when browser storage is unavailable.
    }
  }, [draftKey, draft]);

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: message changes trigger scroll restoration after the DOM renders the new history.
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sendingLock.current || attachments.busy || (!draft.trim() && !attachments.items.length))
      return;
    typing.stop();
    sendingLock.current = true;
    setSending(true);
    setSendFailed(false);
    setSendError("");
    let media: MessageMediaInput[];
    try {
      media = await attachments.uploadAll();
    } catch {
      sendingLock.current = false;
      setSending(false);
      setSendFailed(true);
      return;
    }
    const request = messageDraft(
      draft,
      pendingDraft.current,
      () => {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
      },
      media,
    );
    if (!request) {
      sendingLock.current = false;
      setSending(false);
      return;
    }
    pendingDraft.current = request;
    void write(
      (signal) => sendMessage(id, request, signal),
      (message) => {
        pendingDraft.current = null;
        offset.current = null;
        setAtEnd(true);
        history.update((items) =>
          items.some((item) => item.id === message.id) ? items : mergeById(items, [message]),
        );
        history.reload();
        setDraft("");
        attachments.clear();
        try {
          sessionStorage.removeItem(draftKey);
        } catch {
          // Ignore unavailable storage after a successful message.
        }
        sendingLock.current = false;
        setSending(false);
        onActivity();
      },
      (error) => {
        sendingLock.current = false;
        setSending(false);
        setSendFailed(true);
        setSendError(error instanceof Error ? error.message : "");
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
    <section className="mx-inbox-panel mx-inbox-thread" aria-label="Cuộc trò chuyện">
      <header className="mx-inbox-panel-head mx-inbox-thread-head">
        <a className="button mx-inbox-back" href="/messages" aria-label="Về danh sách trò chuyện">
          <Icon name="back" />
        </a>
        {peer && <Avatar person={peer} />}
        <div className="mx-inbox-person">
          <h2>{peer?.displayName || peer?.username || "Cuộc trò chuyện"}</h2>
          {peer && (
            <p className="mx-inbox-typing" aria-live="polite">
              {typing.isPeerTyping
                ? `${peer.displayName || peer.username} đang nhập…`
                : `@${peer.username}`}
            </p>
          )}
        </div>
      </header>
      {conversation.failed && (
        <Status text="Không thể tải thông tin cuộc trò chuyện." retry={conversation.reload} />
      )}
      <div
        ref={log}
        className="mx-inbox-log"
        onScroll={(event) => {
          const element = event.currentTarget;
          setAtEnd(element.scrollHeight - element.scrollTop - element.clientHeight < 48);
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
        {messages?.length === 0 && <Status text="Chưa có tin nhắn. Hãy gửi lời chào!" />}
        {messages && messages.length > 0 && (
          <ol className="mx-inbox-bubbles" aria-label="Tin nhắn">
            {messages.map((message) => (
              <li key={message.id} className={message.senderId === userId ? "is-mine" : ""}>
                <span className="mx-inbox-sr">
                  {message.senderId === userId ? "Bạn: " : `${peer?.displayName || "Người nhận"}: `}
                </span>
                <p>
                  {message.deletedAt || message.body === null ? (
                    <em>Tin nhắn đã xóa</em>
                  ) : (
                    message.body
                  )}
                </p>
                {!message.deletedAt && <MessageMedia items={message.media ?? []} />}
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
        <Status text="Không thể đánh dấu đã đọc." retry={() => setReadFailed(false)} />
      )}
      {history.page && peer && (
        <form className="mx-inbox-form mx-inbox-reply" onSubmit={submit}>
          <div className="mx-message-attachments">
            {attachments.items.map((item, index) => (
              <div key={item.id}>
                <img src={item.preview} alt={`Ảnh chờ gửi ${index + 1}`} />
                <button
                  className="button"
                  type="button"
                  aria-label={`Bỏ ảnh ${index + 1}`}
                  disabled={sending}
                  onClick={() => attachments.remove(item.id)}
                >
                  ×
                </button>
                {item.state === "uploading" && (
                  <progress
                    max={100}
                    value={item.progress}
                    aria-label={`Đang tải ảnh ${index + 1}`}
                  />
                )}
                {item.state === "ready" && <span>Đã tải lên</span>}
                {item.state === "error" && (
                  <button
                    className="button"
                    type="button"
                    disabled={sending || attachments.busy}
                    onClick={() => void attachments.retry(item.id)}
                  >
                    Thử lại ảnh {index + 1}
                  </button>
                )}
              </div>
            ))}
          </div>
          <label className="mx-message-picker">
            Thêm ảnh
            <input
              aria-label="Thêm ảnh"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={sending || attachments.busy || attachments.items.length >= 5}
              onChange={(event) => {
                attachments.add(Array.from(event.target.files ?? []));
                event.target.value = "";
              }}
            />
          </label>
          {attachments.error && (
            <p role="alert" className="mx-inbox-error">
              {attachments.error}
            </p>
          )}
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
              typing.changed(event.target.value);
              setSendFailed(false);
            }}
          />
          <button
            type="submit"
            className="button button-primary"
            disabled={sending || attachments.busy || (!draft.trim() && !attachments.items.length)}
          >
            <Icon name="send" /> {sending ? "Đang gửi…" : "Gửi"}
          </button>
          {sendFailed && (
            <p className="mx-inbox-error" role="alert">
              Không thể gửi tin nhắn. {sendError && `${sendError} `}Nội dung và ảnh vẫn được giữ;
              hãy thử gửi lại.
            </p>
          )}
        </form>
      )}
    </section>
  );
}
