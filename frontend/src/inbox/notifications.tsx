import { useState } from "react";
import { markAllNoticesRead, markNoticeRead, readNotices } from "./data";
import type { Notice } from "./data";
import { usePages, useWrite } from "./use-inbox";
import { Avatar, Icon, Pager, Status, Time } from "./ui";

const action: Record<Notice["type"], string> = {
  LIKE: "đã thích bài viết của bạn",
  REPLY: "đã trả lời bài viết của bạn",
  REPOST: "đã chia sẻ bài viết của bạn",
  QUOTE: "đã trích dẫn bài viết của bạn",
  FOLLOW: "đã theo dõi bạn",
};

const actorHref = (actor: Notice["actor"]) =>
  actor ? `/profile/${encodeURIComponent(actor.username)}` : undefined;
const postHref = (post: Notice["post"]) =>
  post ? `/posts/${encodeURIComponent(post.id)}` : undefined;

export function Notifications({
  revision,
  count,
  onRead,
}: {
  revision: number;
  count?: number;
  onRead: () => void;
}) {
  const notices = usePages(readNotices, revision);
  const write = useWrite();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const items = notices.page?.items;
  function mark(id?: string) {
    if (pending) return;
    setPending(true);
    setError(false);
    setAnnouncement("");
    void write<{ success: boolean }>(
      (signal) => (id ? markNoticeRead(id, signal) : markAllNoticesRead(signal)),
      (result) => {
        setPending(false);
        if (!result.success) {
          setError(true);
          return;
        }
        notices.update((current) =>
          current.map((notice) => (!id || notice.id === id ? { ...notice, isRead: true } : notice)),
        );
        setAnnouncement(
          id ? "Đã đánh dấu thông báo là đã đọc." : "Đã đánh dấu tất cả thông báo là đã đọc.",
        );
        onRead();
      },
      () => {
        setError(true);
        setPending(false);
      },
    );
  }

  return (
    <section className="mx-inbox-panel mx-inbox-notices" aria-labelledby="mx-inbox-notice-title">
      <header className="mx-inbox-panel-head">
        <h2 id="mx-inbox-notice-title">Hoạt động</h2>
        <button
          type="button"
          className="button"
          onClick={() => mark()}
          disabled={pending || !(count || items?.some((item) => !item.isRead))}
        >
          <Icon name="check" /> Đọc tất cả
        </button>
      </header>
      <span className="mx-inbox-sr" role="status">
        {announcement}
      </span>
      {error && <Status text="Không thể đánh dấu đã đọc. Hãy thử lại." />}
      {!items && !notices.failure && <Status text="Đang tải thông báo…" />}
      {items?.length === 0 && <Status text="Chưa có thông báo nào." />}
      {items && items.length > 0 && (
        <ul className="mx-inbox-list" aria-label="Thông báo">
          {items.map((notice) => (
            <li key={notice.id} className={`mx-inbox-notice${notice.isRead ? "" : " is-unread"}`}>
              <Avatar person={notice.actor} />
              <div className="mx-inbox-notice-copy">
                <p>
                  <strong>
                    {notice.actor ? (
                      <a href={actorHref(notice.actor)}>
                        {notice.actor.displayName || notice.actor.username}
                      </a>
                    ) : (
                      "Một người dùng"
                    )}
                  </strong>{" "}
                  {action[notice.type]}.
                </p>
                {notice.post && (
                  <blockquote>
                    <a href={postHref(notice.post)}>{notice.post.content || "Mở bài viết"}</a>
                  </blockquote>
                )}
                <Time value={notice.createdAt} />
              </div>
              {!notice.isRead && (
                <button
                  type="button"
                  className="button mx-inbox-mark"
                  onClick={() => mark(notice.id)}
                  disabled={pending}
                  aria-label={`Đánh dấu thông báo từ ${notice.actor?.displayName || notice.actor?.username || "một người dùng"} là đã đọc`}
                >
                  <Icon name="check" /> <span>Đánh dấu đã đọc</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Pager {...notices} cursor={notices.page?.cursor} />
    </section>
  );
}
