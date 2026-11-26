import type { FormEvent, MouseEvent, ReactNode } from "react";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api, apiOrigin, sessionClient } from "./api";
import { Auth } from "./auth";
import { bindTypingSocket, createSocketRecovery } from "./realtime";
import { resolveRoute, safeReturn } from "./routes";
import type { AuthResult, User } from "./session";
import { ThemeToggle } from "./theme";
import { Avatar, Icon, Logo } from "./ui";

const Social = lazy(() => import("./social/index").then((m) => ({ default: m.Social })));
const People = lazy(() => import("./people/index").then((m) => ({ default: m.People })));
const Inbox = lazy(() => import("./inbox/index").then((m) => ({ default: m.Inbox })));
const here = () => window.location.pathname + window.location.search;
const topLinks = [
  ["/", "Bảng tin", "home"],
  ["/explore", "Khám phá", "compass"],
  ["/notifications", "Thông báo", "bell"],
  ["/messages", "Tin nhắn", "mail"],
];
const personalLinks = [
  ["/bookmarks", "Đã lưu", "bookmark"],
  ["/likes", "Đã thích", "heart"],
  ["/settings", "Cài đặt", "settings"],
];
const titles: Record<string, string> = {
  "/": "Bảng tin",
  "/explore": "Khám phá",
  "/search": "Tìm kiếm",
  "/bookmarks": "Bài viết đã lưu",
  "/likes": "Bài viết đã thích",
  "/compose": "Viết bài",
  "/login": "Đăng nhập",
  "/register": "Tạo tài khoản",
  "/verify-otp": "Xác minh email",
  "/forgot-password": "Quên mật khẩu",
  "/reset-password": "Đặt lại mật khẩu",
};

type Session = { phase: "loading" | "ready" | "error"; user: User | null };
function Loading({ text = "Đang tải nội dung…" }: { text?: string }) {
  return (
    <div className="shell-wait" role="status">
      <span className="spinner" />
      {text}
    </div>
  );
}

export function App() {
  const [location, setLocation] = useState(here);
  const [session, setSession] = useState<Session>({
    phase: "loading",
    user: null,
  });
  const [startup, setStartup] = useState(0);
  const authEpoch = useRef(0);
  const [logoutError, setLogoutError] = useState("");
  const [ending, setEnding] = useState(false);
  const user = session.user;
  const route = resolveRoute(location);
  const navigate = useCallback((to: string, replace = false) => {
    if (!to.startsWith("/") || to.startsWith("//") || to.includes("\\") || here() === to) return;
    if (replace) history.replaceState(null, "", to);
    else history.pushState(null, "", to);
    setLocation(here());
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    const onPop = () => setLocation(here());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: startup explicitly retries session initialization after a connection failure.
  useEffect(() => {
    let active = true;
    const epoch = authEpoch.current;
    const clear = sessionClient.onExpired(() => setSession({ phase: "ready", user: null }));
    const controller = new AbortController();
    async function start() {
      try {
        const token = await sessionClient.refresh();
        if (!active || authEpoch.current !== epoch) return;
        const account = token ? await api<User>("/auth/me", { signal: controller.signal }) : null;
        if (active && authEpoch.current === epoch) setSession({ phase: "ready", user: account });
      } catch {
        if (active && authEpoch.current === epoch) setSession({ phase: "error", user: null });
      }
    }
    void start();
    return () => {
      active = false;
      controller.abort();
      clear();
    };
  }, [startup]);
  useEffect(() => {
    if (!user?.id) return;
    const socket = io(apiOrigin || window.location.origin, {
      auth: (callback) => callback({ token: sessionClient.getToken() }),
    });
    const relay = (event: string, data: unknown) =>
      window.dispatchEvent(new CustomEvent("mxh:realtime", { detail: { event, data } }));
    const unbindTyping = bindTypingSocket(socket);
    socket.onAny(relay);
    socket.on("connect", () => relay("connect", null));
    const recovery = createSocketRecovery(socket, sessionClient.refresh);
    socket.on("connect", recovery.connected);
    socket.on("connect_error", () => {
      void recovery.recover();
    });
    socket.on("disconnect", (reason) => {
      relay("disconnect", null);
      if (reason === "io server disconnect") void recovery.recover();
    });
    return () => {
      unbindTyping();
      relay("disconnect", null);
      recovery.dispose();
      socket.offAny(relay);
      socket.off();
      socket.disconnect();
    };
  }, [user?.id]);
  useEffect(() => {
    if (session.phase !== "ready") return;
    if (route.private && !user)
      navigate(`/login?${new URLSearchParams({ next: route.path })}`, true);
    if (route.area === "auth" && user)
      navigate(safeReturn(new URLSearchParams(route.path.split("?")[1]).get("next")), true);
  }, [route.private, route.area, route.path, navigate, session.phase, user]);
  useEffect(() => {
    const pathname = route.path.split("?")[0];
    const title =
      titles[pathname] ??
      (route.area === "inbox"
        ? pathname === "/notifications"
          ? "Thông báo"
          : "Tin nhắn"
        : route.area === "people"
          ? pathname === "/settings"
            ? "Cài đặt"
            : "Hồ sơ"
          : "");
    document.title = title ? `${title} · MXH` : "MXH";
  }, [route.path, route.area]);

  function intercept(event: MouseEvent<HTMLDivElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const anchor = (event.target as Element).closest("a");
    if (
      !anchor ||
      anchor.hasAttribute("download") ||
      (anchor.target && anchor.target !== "_self") ||
      anchor.getAttribute("href")?.startsWith("#")
    )
      return;
    const url = new URL(anchor.href);
    if (url.origin !== window.location.origin) return;
    event.preventDefault();
    navigate(url.pathname + url.search, anchor.dataset.replace === "true");
  }
  function setUser(next: User | null) {
    authEpoch.current += 1;
    if (!next) sessionClient.setToken(null);
    setSession({ phase: "ready", user: next });
  }
  function login(result: AuthResult) {
    sessionClient.setToken(result.accessToken);
    setUser(result.user);
  }
  function logout() {
    setEnding(true);
    setLogoutError("");
    void api("/auth/logout", { method: "POST", auth: false })
      .then(() => {
        setUser(null);
        navigate("/login", true);
      })
      .catch(() => setLogoutError("Chưa đăng xuất được. Hãy kiểm tra kết nối và thử lại."))
      .finally(() => setEnding(false));
  }

  let page: ReactNode;
  if (session.phase === "loading" || (session.phase === "ready" && route.private && !user))
    page = (
      <main id="noi-dung">
        <Loading text="Đang kiểm tra phiên đăng nhập…" />
      </main>
    );
  else if (route.area === "auth")
    page = <Auth key={route.path} path={route.path} onLogin={login} navigate={navigate} />;
  else if (session.phase === "error" && route.private)
    page = (
      <main id="noi-dung" className="shell-failure">
        <Logo />
        <h1>Không kết nối được</h1>
        <p>MXH chưa thể kiểm tra phiên đăng nhập của bạn.</p>
        <button
          type="button"
          className="button button-primary"
          onClick={() => {
            setSession({ phase: "loading", user: null });
            setStartup((v) => v + 1);
          }}
        >
          Thử lại
        </button>{" "}
        <a className="button" href="/explore">
          Xem bài viết công khai
        </a>
      </main>
    );
  else
    page = (
      <Shell
        key={user?.id ?? "anonymous"}
        route={route.path}
        user={user}
        navigate={navigate}
        logout={logout}
        logoutError={logoutError}
        ending={ending}
      >
        <Suspense fallback={<Loading />}>
          {route.area === "social" && <Social path={route.path} user={user} />}
          {route.area === "people" && (
            <People
              path={route.path}
              user={user}
              onUser={(next) => {
                if (!next || sessionClient.getToken()) setUser(next);
              }}
            />
          )}
          {route.area === "inbox" && <Inbox path={route.path} user={user} />}
          {route.area === "missing" && (
            <section className="shell-failure">
              <h1>Không tìm thấy trang</h1>
              <p>Đường dẫn có thể đã thay đổi hoặc không còn tồn tại.</p>
              <a href="/explore" className="button button-primary">
                Khám phá bài viết
              </a>
            </section>
          )}
        </Suspense>
      </Shell>
    );
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: Delegated navigation intercepts native anchor clicks, including keyboard-generated clicks.
    <div onClick={intercept}>
      <a className="skip" href="#noi-dung">
        Đi tới nội dung
      </a>
      {page}
    </div>
  );
}

function Shell({
  route,
  user,
  navigate,
  logout,
  logoutError,
  ending,
  children,
}: {
  route: string;
  user: User | null;
  navigate: (path: string) => void;
  logout: () => void;
  logoutError: string;
  ending: boolean;
  children: ReactNode;
}) {
  const pathname = route.split("?")[0];
  const params = new URLSearchParams(route.split("?")[1]);
  const [counts, setCounts] = useState({ mail: 0, bell: 0 });
  const [more, setMore] = useState(false);
  const morePanel = useRef<HTMLDivElement>(null);
  const moreToggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!more) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!morePanel.current?.contains(target) && !moreToggle.current?.contains(target))
        setMore(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setMore(false);
      moreToggle.current?.focus();
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [more]);
  const [term, setTerm] = useState(params.get("q") ?? "");
  useEffect(() => {
    setTerm(new URLSearchParams(route.split("?")[1]).get("q") ?? "");
    setMore(false);
  }, [route]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: navigation refreshes unread counts to reconcile server changes while the socket was unavailable.
  useEffect(() => {
    if (!user?.id) return;
    let live = true;
    const versions = { mail: 0, bell: 0 };
    function refresh() {
      const update = (key: keyof typeof versions, endpoint: string) => {
        const ticket = ++versions[key];
        void api<{ count: number }>(endpoint)
          .then((result) => {
            if (live && versions[key] === ticket)
              setCounts((previous) => ({ ...previous, [key]: result.count }));
          })
          .catch(() => {});
      };
      update("mail", "/conversations/unread-count");
      update("bell", "/notifications/unread-count");
    }
    const receive = (e: Event) => {
      const detail = (e as CustomEvent<{ event: string; data: { count?: number } | null }>).detail;
      if (detail.event === "connect") void refresh();
      const key =
        detail.event === "conversation:unread-count"
          ? "mail"
          : detail.event === "notification:unread-count"
            ? "bell"
            : null;
      const count = detail.data?.count;
      if (key && typeof count === "number") {
        versions[key]++;
        setCounts((previous) => ({ ...previous, [key]: count }));
      }
    };
    void refresh();
    window.addEventListener("mxh:realtime", receive);
    return () => {
      live = false;
      window.removeEventListener("mxh:realtime", receive);
    };
  }, [user?.id, pathname]);
  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    if (term.trim()) navigate(`/search?${new URLSearchParams({ q: term.trim() })}`);
  };
  const links = user ? topLinks : topLinks.slice(0, 2);
  const profile = user ? `/profile/${encodeURIComponent(user.username)}` : "/login";
  const wide = pathname.startsWith("/messages");
  function navLink([url, label, icon]: string[]) {
    const active = pathname === url || (url !== "/" && pathname.startsWith(`${url}/`));
    const count = counts[icon as keyof typeof counts];
    return (
      <a
        className={active ? "nav-link active" : "nav-link"}
        href={url}
        key={url}
        aria-current={active ? "page" : undefined}
        aria-label={count > 0 ? `${label}, ${count} chưa đọc` : undefined}
        title={label}
      >
        <Icon name={icon} active={active} />
        <span>{label}</span>
        {count > 0 && (
          <b className="nav-count" aria-hidden="true">
            {count > 99 ? "99+" : count}
          </b>
        )}
      </a>
    );
  }
  return (
    <div className={wide ? "workspace workspace-wide" : "workspace"}>
      <aside className="rail">
        <Logo />
        <nav aria-label="Điều hướng chính" className="rail-nav">
          {links.map(navLink)}
          {user && <div className="rail-personal">{personalLinks.map(navLink)}</div>}
        </nav>
        {user ? (
          <>
            <a className="button button-primary rail-write" href="/compose">
              <Icon name="plus" size={19} />
              <span>Viết bài</span>
            </a>
            <div className="rail-account">
              <a href={profile}>
                <Avatar user={user} />
                <span>
                  <strong>{user.displayName}</strong>
                  <small>@{user.username}</small>
                </span>
              </a>
              <button
                className="icon-button"
                type="button"
                onClick={logout}
                title="Đăng xuất"
                aria-label="Đăng xuất"
                disabled={ending}
              >
                <Icon name="exit" size={18} />
              </button>
            </div>
          </>
        ) : (
          <a className="button button-primary rail-write" href="/login">
            <span>Đăng nhập</span> <Icon name="arrow" size={18} />
          </a>
        )}
      </aside>
      <div className="workspace-body">
        <header className="workspace-top">
          <div className="mobile-brand">
            <Logo />
          </div>
          {/* biome-ignore lint/a11y/useSemanticElements: The search landmark is a native form with submit behavior. */}
          <form onSubmit={submitSearch} className="workspace-search" role="search">
            <button type="submit" aria-label="Tìm kiếm">
              <Icon name="search" size={18} />
            </button>
            <input
              aria-label="Tìm bài viết và tài khoản"
              type="search"
              placeholder="Tìm bài viết, tài khoản…"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              maxLength={100}
            />
          </form>
          <ThemeToggle />
          <a className="top-profile" href={profile}>
            {user ? <Avatar user={user} /> : "Đăng nhập"}
            <span className="sr-only">{user ? "Hồ sơ của bạn" : ""}</span>
          </a>
        </header>
        <div className="workspace-grid">
          <main id="noi-dung" className="workspace-content" tabIndex={-1}>
            {logoutError && (
              <p className="notice is-error" role="alert">
                {logoutError}
              </p>
            )}
            {children}
          </main>
          {!wide && (
            <aside className="workspace-side" aria-label="Gợi ý điều hướng">
              <section className="side-block side-feature">
                <span className="side-symbol">
                  <Icon name="compass" size={23} />
                </span>
                <h2>Tìm người để theo dõi</h2>
                <p>Bảng tin sẽ có bài mới khi những người bạn theo dõi đăng bài.</p>
                <a href="/people">
                  Tìm tài khoản <Icon name="arrow" size={16} />
                </a>
              </section>
              {user && (
                <section className="side-block side-saved">
                  <h2>Đọc lại lúc rảnh</h2>
                  <p>Lưu một bài viết để mở lại bất cứ lúc nào.</p>
                  <a href="/bookmarks">
                    Mở bài viết đã lưu <Icon name="arrow" size={16} />
                  </a>
                </section>
              )}
              <p className="side-footer">
                MXH <span>·</span> Tiếng Việt
              </p>
            </aside>
          )}
        </div>
      </div>
      <nav className="phone-nav" aria-label="Điều hướng trên điện thoại">
        {links.map(navLink)}
        {user && (
          <button
            ref={moreToggle}
            type="button"
            className="nav-link"
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            aria-controls="phone-more"
          >
            <Icon name={more ? "close" : "menu"} />
            <span>Thêm</span>
          </button>
        )}
      </nav>
      {user && (
        <div ref={morePanel} id="phone-more" className="phone-more" hidden={!more}>
          <a className="button button-primary" href="/compose">
            <Icon name="plus" />
            Viết bài
          </a>
          {personalLinks.map(navLink)}
          {navLink([profile, "Hồ sơ", "person"])}
          <button
            type="button"
            className="nav-link"
            onClick={() => {
              logout();
              setMore(false);
            }}
            disabled={ending}
          >
            <Icon name="exit" />
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}
