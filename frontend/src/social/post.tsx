import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { api } from "../api";
import type { User } from "../session";
import {
  MAX_CONTENT,
  VISIBILITIES,
  composePath,
  editPayload,
  isActive,
  postPath,
  postToggle,
  profilePath,
  repostTarget,
} from "./model";
import type { ActivePost, Post, PostChange, Toggle, Visibility } from "./model";
import { errorLabel } from "./requests";
import { Avatar, Icon, MediaView, VisibilityPicker } from "./ui";

const dateFormat = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "medium",
  timeStyle: "short",
});
const countFormat = new Intl.NumberFormat("vi-VN", { notation: "compact" });
const login = "/login";
const labels: Record<Toggle, [string, string]> = {
  like: ["Thích", "Bỏ thích"],
  repost: ["Đăng lại", "Bỏ đăng lại"],
  bookmark: ["Lưu bài", "Bỏ lưu bài"],
};

function Time({ value, id }: { value: string; id: string }) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <a href={postPath(id)}>Xem bài viết</a>;
  return (
    <a href={postPath(id)} aria-label={`Mở bài viết lúc ${dateFormat.format(date)}`}>
      <time dateTime={value}>{dateFormat.format(date)}</time>
    </a>
  );
}

function EditPost({
  post,
  busy,
  save,
  cancel,
}: {
  post: ActivePost;
  busy: boolean;
  save: (text: string, visibility: Visibility) => void;
  cancel: () => void;
}) {
  const [text, setText] = useState(post.content ?? "");
  const [visibility, setVisibility] = useState(post.visibility);
  const length = Array.from(text).length;
  const disabled =
    busy ||
    length > MAX_CONTENT ||
    (!text.trim() && !post.media.length && !post.quotedPostId) ||
    (text === (post.content ?? "") && visibility === post.visibility);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!disabled) save(text.trim(), visibility);
  }
  return (
    <form className="social-edit" onSubmit={submit}>
      <label>
        Nội dung bài viết
        <textarea
          autoFocus
          value={text}
          rows={4}
          disabled={busy}
          onChange={(event) => setText(event.currentTarget.value)}
        />
      </label>
      <div className="social-compose-tools">
        <VisibilityPicker value={visibility} onChange={setVisibility} disabled={busy} />
        <span className="social-count" data-over={length > MAX_CONTENT}>
          {length}/{MAX_CONTENT}
        </span>
        <button className="button" type="button" disabled={busy} onClick={cancel}>
          Hủy
        </button>
        <button className="button button-primary" type="submit" disabled={disabled}>
          {busy ? "Đang lưu…" : "Lưu thay đổi"}
        </button>
      </div>
    </form>
  );
}

type CardProps = {
  post: Post;
  user: User | null;
  change: (change: PostChange) => void;
  featured?: boolean;
  threaded?: boolean;
};
export function PostCard({ post, user, change, featured, threaded }: CardProps) {
  const target = repostTarget(post);
  const [panel, setPanel] = useState<"edit" | "delete" | null>(null);
  const [busy, setBusy] = useState<Toggle | "edit" | "delete" | null>(null);
  const [error, setError] = useState("");
  const [viewerState, setViewerState] = useState<ActivePost["interactions"]>();
  const menu = useRef<HTMLDetailsElement>(null);
  const menuToggle = useRef<HTMLElement>(null);
  const lock = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (menu.current?.open && !menu.current.contains(event.target as Node))
        menu.current.open = false;
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);

  async function perform(
    action: NonNullable<typeof busy>,
    task: (signal: AbortSignal) => Promise<void>,
  ) {
    if (!user || lock.current) return;
    lock.current = true;
    const controller = new AbortController();
    request.current = controller;
    setBusy(action);
    setError("");
    try {
      await task(controller.signal);
    } catch (failure) {
      if (!controller.signal.aborted)
        setError(errorLabel(failure, "Không thực hiện được thao tác. Vui lòng thử lại."));
    } finally {
      lock.current = false;
      if (!controller.signal.aborted) setBusy(null);
    }
  }
  function closePanel() {
    setPanel(null);
    setError("");
    menuToggle.current?.focus();
  }

  if (!isActive(post))
    return (
      <article className="social-post social-tombstone">
        <div>
          <Icon name="post" />
          <p>{post.isDeleted ? "Bài viết đã được xóa." : "Bài viết không còn khả dụng."}</p>
        </div>
        {!featured && Boolean(post.replyCount) && (
          <a href={postPath(post.id)}>Xem cuộc trò chuyện</a>
        )}
      </article>
    );

  const wrapper = Boolean(post.repostOfId);
  const authoredWrapper = wrapper && post.author.id === user?.id;
  const isOwner = !wrapper && target?.author.id === user?.id && Boolean(user);
  const viewer = target && (viewerState ?? target.interactions);
  const reposted = Boolean(authoredWrapper || viewer?.isReposted);
  const postDate = target ?? post;

  async function toggle(action: Toggle) {
    if (!target) return;
    await perform(action, async (signal) => {
      // Embedded originals may omit viewer flags. Check the target, not the wrapper, before toggling.
      const current = wrapper
        ? await api<Post>(postPath(target.id), { auth: true, signal })
        : target;
      if (!isActive(current)) throw new Error("Bài gốc không còn khả dụng.");
      const source = authoredWrapper
        ? {
            ...current,
            interactions: { ...current.interactions, isReposted: true },
          }
        : current;
      const next = postToggle(source, action);
      const response = await api<
        | {
            liked?: boolean;
            bookmarked?: boolean;
            reposted?: boolean;
            likeCount?: number;
            repostCount?: number;
          }
        | undefined
      >(next.path, { method: next.method, auth: true, signal });
      if (signal.aborted) return;
      const active = next.active
        ? ((action === "like"
            ? response?.liked
            : action === "bookmark"
              ? response?.bookmarked
              : response?.reposted) ?? true)
        : false;
      const countKey =
        action === "like" ? "likeCount" : action === "repost" ? "repostCount" : "bookmarkCount";
      const count =
        action === "like"
          ? response?.likeCount
          : action === "repost"
            ? response?.repostCount
            : undefined;
      const flag =
        action === "like" ? "isLiked" : action === "bookmark" ? "isBookmarked" : "isReposted";
      if (wrapper) setViewerState({ ...source.interactions, [flag]: active });
      change({
        id: source.id,
        kind: "toggle",
        action,
        active,
        count:
          count ??
          Math.max(
            0,
            source.counters[countKey] + Number(active) - Number(source.interactions[flag]),
          ),
      });
      if (authoredWrapper && action === "repost" && !active)
        change({ id: post.id, kind: "delete" });
    });
  }

  function actionButton(action: Toggle, active: boolean, count: number) {
    const label = labels[action][Number(active)] ?? labels[action][0];
    if (!user)
      return (
        <a
          className="social-post-action"
          title={label}
          aria-label={`${label} · Đăng nhập`}
          href={login}
        >
          <Icon name={action === "like" ? "heart" : action} />
          {count > 0 && <span>{countFormat.format(count)}</span>}
        </a>
      );
    return (
      <button
        className="social-post-action"
        type="button"
        title={label}
        aria-label={`${label}${count ? `: ${count}` : ""}`}
        aria-pressed={active}
        disabled={busy !== null}
        onClick={() => void toggle(action)}
      >
        <Icon name={action === "like" ? "heart" : action} />
        {count > 0 && <span>{countFormat.format(count)}</span>}
      </button>
    );
  }

  let ownedMenu: ReactNode;
  if (isOwner)
    ownedMenu = (
      <details
        ref={menu}
        className="social-post-menu"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            if (menu.current) menu.current.open = false;
            menuToggle.current?.focus();
          }
        }}
      >
        <summary
          ref={(element) => {
            menuToggle.current = element;
          }}
          className="social-icon-button"
          aria-label="Tùy chọn bài viết"
        >
          <Icon name="more" />
        </summary>
        <div>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              if (menu.current) menu.current.open = false;
              setError("");
              setPanel("edit");
            }}
          >
            <Icon name="pen" /> Sửa bài / quyền xem
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              if (menu.current) menu.current.open = false;
              setError("");
              setPanel("delete");
            }}
          >
            <Icon name="trash" /> Xóa bài viết
          </button>
        </div>
      </details>
    );

  return (
    <article
      className="social-post"
      data-featured={Boolean(featured)}
      aria-label={target ? `Bài viết của ${target.author.displayName}` : "Bài đăng lại"}
    >
      {wrapper && (
        <p className="social-repost-label">
          <Icon name="repost" />
          <span>
            <a href={profilePath(post.author.username)}>{post.author.displayName}</a> đã đăng lại
          </span>
          {featured && <Time id={post.id} value={post.createdAt} />}
        </p>
      )}
      {!target ? (
        <div className="social-reference">
          <p>Bài gốc không còn khả dụng.</p>
          {authoredWrapper && (
            <button
              className="button"
              type="button"
              disabled={busy !== null}
              onClick={() => {
                void perform("repost", async (signal) => {
                  if (!post.repostOfId) return;
                  await api<void>(`${postPath(post.repostOfId)}/repost`, {
                    method: "DELETE",
                    auth: true,
                    signal,
                  });
                  if (!signal.aborted) change({ id: post.id, kind: "delete" });
                });
              }}
            >
              Bỏ đăng lại
            </button>
          )}
          {error && (
            <p className="social-error" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : (
        <>
          <header className="social-byline">
            <a
              href={profilePath(target.author.username)}
              aria-label={`Hồ sơ của ${target.author.displayName}`}
            >
              <Avatar key={target.author.avatarUrl ?? target.author.id} user={target.author} />
            </a>
            <div className="social-byline-text">
              <a className="social-author" href={profilePath(target.author.username)}>
                {target.author.displayName}
              </a>
              <span>@{target.author.username}</span>
            </div>
            <div className="social-post-meta">
              <Time id={postDate.id} value={postDate.createdAt} />
              {target.editedAt && <span>Đã sửa</span>}
            </div>
            {ownedMenu}
          </header>
          {panel === "edit" ? (
            <EditPost
              post={target}
              busy={busy !== null}
              cancel={closePanel}
              save={(content, visibility) => {
                void perform("edit", async (signal) => {
                  const edited = await api<Post>(postPath(target.id), {
                    method: "PATCH",
                    body: editPayload(target, content, visibility),
                    auth: true,
                    signal,
                  });
                  if (!signal.aborted && isActive(edited)) {
                    change({ id: target.id, kind: "edit", post: edited });
                    closePanel();
                  }
                });
              }}
            />
          ) : (
            <div className="social-post-body">
              {!threaded && target.parentId && (
                <a className="social-reply-context" href={postPath(target.parentId)}>
                  <Icon name="reply" /> Đang trả lời một bài viết
                </a>
              )}
              {target.content && <p className="social-post-copy">{target.content}</p>}
              <MediaView media={target.media} />
              {target.quotedPostId && (
                <div className="social-quote">
                  {target.quotedPost ? (
                    <>
                      <a href={postPath(target.quotedPost.id)}>
                        <Icon name="quote" />
                        {target.quotedPost.author
                          ? `${target.quotedPost.author.displayName} · @${target.quotedPost.author.username}`
                          : "Xem bài được trích dẫn"}
                      </a>
                      {target.quotedPost.content && <p>{target.quotedPost.content}</p>}
                      <MediaView media={target.quotedPost.media} />
                    </>
                  ) : (
                    <p>Bài được trích dẫn không còn khả dụng.</p>
                  )}
                </div>
              )}
            </div>
          )}
          {panel === "delete" && (
            <div className="social-delete">
              <strong>Xóa bài viết này?</strong>
              <p>Không thể khôi phục nội dung đã xóa.</p>
              <button
                className="button"
                type="button"
                autoFocus
                disabled={busy !== null}
                onClick={closePanel}
              >
                Giữ bài viết
              </button>
              <button
                className="button social-danger"
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  void perform("delete", async (signal) => {
                    await api<void>(postPath(target.id), {
                      method: "DELETE",
                      auth: true,
                      signal,
                    });
                    if (!signal.aborted) {
                      change({ id: target.id, kind: "delete" });
                      setPanel(null);
                    }
                  })
                }
              >
                {busy === "delete" ? "Đang xóa…" : "Xóa bài viết"}
              </button>
            </div>
          )}
          {target.visibility !== "PUBLIC" && (
            <p className="social-visibility-note">{VISIBILITIES[target.visibility]}</p>
          )}
          <footer className="social-post-actions" aria-label="Tương tác bài viết">
            <a
              className="social-post-action"
              href={
                featured && !wrapper ? "#social-replies" : postPath(target.id) + "#social-replies"
              }
              aria-label={`Xem ${target.counters.replyCount} trả lời`}
              title="Trả lời"
            >
              <Icon name="reply" />
              {target.counters.replyCount > 0 && (
                <span>{countFormat.format(target.counters.replyCount)}</span>
              )}
            </a>
            {actionButton("like", Boolean(viewer?.isLiked), target.counters.likeCount)}
            {(target.visibility === "PUBLIC" || reposted) &&
              actionButton("repost", reposted, target.counters.repostCount)}
            {target.visibility === "PUBLIC" && (
              <a
                className="social-post-action"
                title="Trích dẫn"
                aria-label="Trích dẫn"
                href={user ? composePath({ quotedPostId: target.id }) : login}
              >
                <Icon name="quote" />
                {target.counters.quoteCount > 0 && (
                  <span>{countFormat.format(target.counters.quoteCount)}</span>
                )}
              </a>
            )}
            {actionButton("bookmark", Boolean(viewer?.isBookmarked), target.counters.bookmarkCount)}
          </footer>
          {error && (
            <p className="social-error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
    </article>
  );
}
