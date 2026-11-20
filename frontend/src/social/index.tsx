import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { User } from "../session";
import { Composer } from "./composer";
import {
  composePath,
  isActive,
  mergePostChange,
  postPath,
  resolveSocial,
  timelinePath,
} from "./model";
import type { Post, PostChange, SocialRoute, Toggle } from "./model";
import { PostCard } from "./post";
import { usePostPages, useQuery } from "./requests";
import { Icon, Loading, Message } from "./ui";
import "./social.css";

const listing = {
  home: {
    title: "Bảng tin",
    description: "Bài viết mới từ những người bạn theo dõi.",
    empty: "Dòng thời gian còn trống",
    hint: "Theo dõi thêm người để thấy bài viết của họ ở đây.",
  },
  explore: {
    title: "Khám phá",
    description: "Đọc những bài viết công khai từ cộng đồng.",
    empty: "Không có bài viết để hiển thị",
    hint: "Thử đổi bộ lọc hoặc quay lại sau.",
  },
  search: {
    title: "Tìm kiếm",
    description: "Tìm bài viết theo từ khóa.",
    empty: "Không tìm thấy bài viết",
    hint: "Thử một từ khóa khác hoặc bỏ bộ lọc tệp đính kèm.",
  },
  bookmarks: {
    title: "Bài đã lưu",
    description: "Một chỗ để giữ lại những bài bạn muốn đọc sau.",
    empty: "Chưa có bài đã lưu",
    hint: "Bấm biểu tượng lưu dưới bài viết để thêm vào đây.",
  },
  likes: {
    title: "Bài đã thích",
    description: "Xem lại những bài viết bạn đã bấm thích.",
    empty: "Chưa có bài đã thích",
    hint: "Những bài bạn bấm thích sẽ xuất hiện ở đây.",
  },
} as const;

function Heading({
  title,
  text,
  actions,
  back,
}: {
  title: string;
  text?: string;
  actions?: ReactNode;
  back?: string;
}) {
  return (
    <header className="social-heading">
      <div>
        {back && (
          <a className="social-back" href={back}>
            <Icon name="back" /> Về trang chủ
          </a>
        )}
        <h1>{title}</h1>
        {text && <p>{text}</p>}
      </div>
      {actions && <div className="social-heading-actions">{actions}</div>}
    </header>
  );
}

function SignIn({
  description = "Bạn cần đăng nhập để dùng tính năng này.",
}: {
  description?: string;
}) {
  return (
    <Message
      title="Bạn chưa đăng nhập"
      action={
        <a href="/login" className="button button-primary">
          Đăng nhập
        </a>
      }
    >
      {description}
    </Message>
  );
}

function searchUrl(q: string, mediaOnly: boolean, base = "/search") {
  const query = new URLSearchParams();
  if (q) query.set("q", q);
  if (mediaOnly) query.set("mediaOnly", "true");
  return query.size ? `${base}?${query}` : base;
}

function SearchForm({ route }: { route: SocialRoute }) {
  const { view, mediaOnly, q = "" } = route;
  const [input, setInput] = useState(q);
  const [invalid, setInvalid] = useState(false);
  const submitLink = useRef<HTMLAnchorElement>(null);
  const base = view === "explore" ? "/explore" : "/search";
  function submit(event: FormEvent<HTMLFormElement>) {
    const length = input.trim().length;
    if (length < 2 || length > 100) {
      event.preventDefault();
      setInvalid(true);
      return;
    }
    if (submitLink.current) {
      event.preventDefault();
      submitLink.current.click();
    }
  }
  return (
    <div className="social-discovery-tools">
      <form action="/search" role="search" onSubmit={submit}>
        <label className="social-search-field">
          <Icon name="search" />
          <span className="social-sr">Từ khóa tìm bài viết</span>
          <input
            name="q"
            type="search"
            placeholder="Tìm theo nội dung bài viết"
            autoComplete="off"
            value={input}
            maxLength={100}
            aria-invalid={invalid}
            aria-describedby={invalid ? "social-search-error" : undefined}
            onChange={(event) => {
              setInput(event.currentTarget.value);
              setInvalid(false);
            }}
          />
        </label>
        {mediaOnly && <input type="hidden" name="mediaOnly" value="true" />}
        <button type="submit" className="button button-primary">
          Tìm bài
        </button>
        <a
          hidden
          ref={submitLink}
          href={searchUrl(input.trim(), Boolean(mediaOnly))}
        >
          Mở kết quả tìm kiếm
        </a>
      </form>
      {invalid && (
        <p className="social-error" role="alert" id="social-search-error">
          Nhập từ 2 đến 100 ký tự để tìm bài viết.
        </p>
      )}
      <nav className="social-filters" aria-label="Lọc theo tệp đính kèm">
        <a
          href={searchUrl(q, false, base)}
          aria-current={!mediaOnly ? "page" : undefined}
        >
          Tất cả
        </a>
        <a
          href={searchUrl(q, true, base)}
          aria-current={mediaOnly ? "page" : undefined}
        >
          <Icon name="image" /> Có tệp đính kèm
        </a>
        <a href={q ? `/people?${new URLSearchParams({ q })}` : "/people"}>
          Tìm tài khoản
        </a>
      </nav>
    </div>
  );
}

type PostPages = ReturnType<typeof usePostPages>;
function PageRows({
  pages,
  user,
  empty,
  hint,
  action,
  change,
  threaded,
}: {
  pages: PostPages;
  user: User | null;
  empty: string;
  hint?: string;
  action?: ReactNode;
  change?: (change: PostChange) => void;
  threaded?: boolean;
}) {
  const { page, loadMore } = pages;
  if (page.status === "loading" && !page.items.length) return <Loading />;
  if (page.status === "error" && !page.items.length)
    return (
      <Message
        title="Không tải được danh sách"
        error
        action={
          <button type="button" className="button" onClick={loadMore}>
            Thử lại
          </button>
        }
      >
        {page.error}
      </Message>
    );
  return (
    <>
      {page.items.length ? (
        <ul
          className="social-post-list"
          aria-label={threaded ? "Danh sách lời trả lời" : "Danh sách bài viết"}
        >
          {page.items.map((post) => (
            <li key={post.id}>
              <PostCard
                post={post}
                user={user}
                change={change ?? pages.apply}
                threaded={threaded}
              />
            </li>
          ))}
        </ul>
      ) : (
        !page.next && (
          <Message title={empty} action={action}>
            {hint}
          </Message>
        )
      )}
      {page.status === "error" || page.status === "more-error" ? (
        <Message
          title="Không tải được thêm bài"
          error
          action={
            <button type="button" className="button" onClick={loadMore}>
              Thử lại
            </button>
          }
        >
          {page.error}
        </Message>
      ) : (
        page.next && (
          <div className="social-more">
            <button
              type="button"
              className="button"
              onClick={loadMore}
              disabled={page.status === "more"}
            >
              {page.status === "more"
                ? "Đang tải…"
                : threaded
                  ? "Xem thêm trả lời"
                  : "Xem thêm bài viết"}
            </button>
            {page.status === "more" && (
              <span className="social-sr" role="status">
                Đang tải thêm bài viết.
              </span>
            )}
          </div>
        )
      )}
    </>
  );
}

function PostListing({
  endpoint,
  user,
  view,
}: {
  endpoint: string;
  user: User | null;
  view: keyof typeof listing;
}) {
  const collection: Toggle | undefined =
    view === "bookmarks" ? "bookmark" : view === "likes" ? "like" : undefined;
  const pages = usePostPages(endpoint, Boolean(user), false, collection);
  const { empty, hint } = listing[view];
  const [latest, setLatest] = useState(false);
  const seenVersion = useRef(0);
  useEffect(() => {
    if (view !== "home" || !user) return;
    const receive = (event: Event) => {
      if (
        (event as CustomEvent<{ event: string }>).detail.event ===
        "feed:new-post"
      ) {
        seenVersion.current++;
        setLatest(true);
      }
    };
    window.addEventListener("mxh:realtime", receive);
    return () => window.removeEventListener("mxh:realtime", receive);
  }, [view, user]);
  return (
    <>
      {view === "home" &&
        (user ? (
          <Composer inline user={user} onCreated={pages.prepend} />
        ) : (
          <div className="social-guest-note">
            <span>Đăng nhập để xem bài từ người bạn theo dõi.</span>
            <a href="/login">
              Đăng nhập <Icon name="arrow" />
            </a>
          </div>
        ))}
      {latest && (
        <div className="social-more">
          <button
            type="button"
            className="button"
            onClick={() => {
              const version = seenVersion.current;
              void pages.reload().then((ok) => {
                if (ok && version === seenVersion.current) setLatest(false);
              });
            }}
          >
            Xem bài viết mới
          </button>
        </div>
      )}
      <PageRows
        pages={pages}
        user={user}
        empty={empty}
        hint={
          view === "home" && !user
            ? "Quay lại sau để xem những bài công khai mới."
            : hint
        }
        action={
          view === "home" && user ? (
            <a className="button" href="/explore">
              Khám phá cộng đồng <Icon name="arrow" />
            </a>
          ) : undefined
        }
      />
    </>
  );
}

function Thread({
  post,
  user,
  changePost,
}: {
  post: Post;
  user: User | null;
  changePost: (change: PostChange) => void;
}) {
  const auth = Boolean(user);
  const endpoint = postPath(post.id);
  const replies = usePostPages(`${endpoint}/replies`, auth, true);
  const ancestors = useQuery<{ ancestors: Post[] }>(
    isActive(post) && post.parentId ? `${endpoint}/ancestors` : undefined,
    auth,
  );
  const ancestorPosts = ancestors.data?.ancestors ?? [];
  function change(value: PostChange) {
    changePost(value);
    replies.apply(value);
    ancestors.setData((current) =>
      current
        ? {
            ancestors: current.ancestors.flatMap(
              (item) => mergePostChange(item, value, true) ?? [],
            ),
          }
        : undefined,
    );
  }
  return (
    <>
      {ancestors.loading && <Loading label="Đang tải bài trước đó…" />}
      {ancestors.error && (
        <div className="social-ancestor-notice">
          <p role="status">Không tải được bài trước đó.</p>
          <button className="button" type="button" onClick={ancestors.reload}>
            Thử lại
          </button>
        </div>
      )}
      {ancestorPosts.length > 0 && (
        <ol
          className="social-post-list social-ancestors"
          aria-label="Bài viết trước đó"
        >
          {ancestorPosts.map((item) => (
            <li key={item.id}>
              <PostCard post={item} user={user} change={change} threaded />
            </li>
          ))}
        </ol>
      )}
      <PostCard post={post} user={user} change={change} featured threaded />
      <section
        className="social-thread"
        id="social-replies"
        aria-labelledby="social-replies-heading"
      >
        <h2 id="social-replies-heading">Trả lời</h2>
        {isActive(post) &&
          !post.repostOfId &&
          (user ? (
            <Composer
              user={user}
              placement={{ parentId: post.id }}
              inline
              onCreated={(reply) => {
                replies.prepend(reply);
                changePost({ id: post.id, kind: "reply" });
              }}
            />
          ) : (
            <div className="social-guest-note">
              <span>Bạn muốn tham gia cuộc trò chuyện?</span>
              <a href="/login">
                Đăng nhập <Icon name="arrow" />
              </a>
            </div>
          ))}
        <PageRows
          pages={replies}
          user={user}
          empty="Chưa có lời trả lời"
          hint={
            isActive(post) && !post.repostOfId
              ? "Bạn có thể mở đầu cuộc trò chuyện."
              : undefined
          }
          change={change}
          threaded
        />
      </section>
    </>
  );
}

function PostDetail({ id, user }: { id: string; user: User | null }) {
  const query = useQuery<Post>(postPath(id), Boolean(user));
  return (
    <>
      <Heading title="Bài viết" back="/" />
      {query.loading ? (
        <Loading />
      ) : query.error ? (
        <Message
          title="Không mở được bài viết"
          error
          action={
            <button className="button" type="button" onClick={query.reload}>
              Thử lại
            </button>
          }
        >
          {query.error}
        </Message>
      ) : (
        query.data && (
          <Thread
            post={query.data}
            user={user}
            changePost={(change) =>
              query.setData((current) =>
                current
                  ? (mergePostChange(current, change, true) ?? undefined)
                  : undefined,
              )
            }
          />
        )
      )}
    </>
  );
}

export function Social({ path, user }: { path: string; user: User | null }) {
  const route = resolveSocial(path, Boolean(user));
  const key = `${path}\n${user?.id ?? ""}`;
  if (route.view === "detail" && route.postId)
    return (
      <div className="social-slice" key={key}>
        <PostDetail id={route.postId} user={user} />
      </div>
    );
  if (route.view === "compose") {
    const placement = route.placement ?? {};
    return (
      <div className="social-slice" key={key}>
        <Heading
          title={
            placement.parentId
              ? "Viết lời trả lời"
              : placement.quotedPostId
                ? "Trích dẫn bài viết"
                : "Viết bài mới"
          }
          text={
            placement.parentId
              ? "Tiếp nối cuộc trò chuyện."
              : placement.quotedPostId
                ? "Chia sẻ bài viết và thêm góc nhìn của bạn."
                : "Chia sẻ suy nghĩ, hình ảnh hoặc một đoạn ghi âm."
          }
          back="/"
        />
        {user ? <Composer user={user} placement={placement} /> : <SignIn />}
      </div>
    );
  }
  if (route.view === "missing" || route.view === "detail")
    return (
      <div className="social-slice">
        <Heading title="Không tìm thấy trang" back="/" />
      </div>
    );
  const view = route.view;
  const { title, description } = listing[view];
  return (
    <div className="social-slice" key={key}>
      <Heading
        title={title}
        text={
          view === "home" && !user
            ? "Bài viết công khai mới từ cộng đồng."
            : description
        }
        actions={
          view === "home" && user ? (
            <a href={composePath({})} className="button">
              <Icon name="pen" /> Viết bài mới
            </a>
          ) : undefined
        }
      />
      {(view === "search" || view === "explore") && (
        <SearchForm route={route} />
      )}
      {view === "search" && route.endpoint && (
        <h2 className="social-results">Kết quả cho “{route.q}”</h2>
      )}
      {route.requiresUser && !user ? (
        <SignIn />
      ) : route.endpoint ? (
        <PostListing endpoint={route.endpoint} user={user} view={view} />
      ) : (
        <Message
          title={
            route.q ? "Từ khóa chưa hợp lệ" : "Tìm bài viết trong cộng đồng"
          }
        >
          {route.q
            ? "Nhập từ 2 đến 100 ký tự để tìm bài viết."
            : "Nhập ít nhất 2 ký tự để bắt đầu."}
        </Message>
      )}
    </div>
  );
}

function TimelineRows({
  endpoint,
  user,
  replies,
}: {
  endpoint: string;
  user: User | null;
  replies: boolean;
}) {
  const pages = usePostPages(endpoint, Boolean(user));
  return (
    <PageRows
      pages={pages}
      user={user}
      empty={
        replies
          ? "Chưa có lời trả lời để hiển thị"
          : "Chưa có bài viết để hiển thị"
      }
    />
  );
}

export function UserTimeline({
  username,
  user,
  revision = 0,
}: {
  username: string;
  user: User | null;
  revision?: number;
}) {
  const [tab, setTab] = useState<{ username: string; replies: boolean }>();
  const replies = tab?.username === username && tab.replies;
  const endpoint = timelinePath(username, replies);
  return (
    <section
      className="social-slice social-embedded"
      aria-label={`Bài viết của @${username}`}
    >
      <div className="social-filters" role="group" aria-label="Loại bài viết">
        <button
          type="button"
          aria-pressed={!replies}
          onClick={() => setTab({ username, replies: false })}
        >
          Bài viết
        </button>
        <button
          type="button"
          aria-pressed={Boolean(replies)}
          onClick={() => setTab({ username, replies: true })}
        >
          Trả lời
        </button>
      </div>
      <TimelineRows
        key={`${endpoint}\n${user?.id ?? ""}\n${revision}`}
        endpoint={endpoint}
        user={user}
        replies={Boolean(replies)}
      />
    </section>
  );
}
