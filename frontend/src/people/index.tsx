import { useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { api } from "../api";
import { InfiniteScrollSentinel } from "../infinite-scroll";
import { Icon } from "../icons";
import type { User } from "../session";
import { UserTimeline } from "../social";
import { Settings } from "./settings";
import { Avatar, LoadFailure, errorText, useResource } from "./shared";
import {
  afterFollow,
  bumpTimelineForFollow,
  createPeopleClient,
  messageHref,
  parsePeoplePath,
  peopleHref,
  profileHref,
  searchProblem,
  uniquePeople,
} from "./contracts";
import type { Connection, PeoplePage, Person } from "./contracts";
import "./people.css";

const client = createPeopleClient(api);
const connectionLabels = {
  followers: "Người theo dõi",
  following: "Đang theo dõi",
};
const number = new Intl.NumberFormat("vi-VN");

function ProfileView({ username, user }: { username: string; user: User | null }) {
  const {
    value: profile,
    setValue,
    error,
    reload,
  } = useResource((signal) => client.profile(username, Boolean(user), signal));
  const [busy, setBusy] = useState(false);
  const [followError, setFollowError] = useState("");
  const [notice, setNotice] = useState("");
  const [timelineRevision, setTimelineRevision] = useState(0);
  const followLock = useRef(false);
  if (error) return <LoadFailure title="Không tải được hồ sơ" error={error} retry={reload} />;
  if (!profile)
    return (
      <p className="people-state" role="status">
        Đang tải hồ sơ…
      </p>
    );
  const self = profile.id === user?.id;

  async function toggleFollow(id: string, follow: boolean, wasFollowing: boolean) {
    if (followLock.current) return;
    followLock.current = true;
    setBusy(true);
    setNotice("");
    setFollowError("");
    try {
      const following = await client.setFollowing(id, follow);
      setValue((current) => (current?.id === id ? afterFollow(current, following) : current));
      setTimelineRevision((current) => bumpTimelineForFollow(current, wasFollowing, following));
      setNotice(following ? "Đã theo dõi." : "Đã bỏ theo dõi.");
    } catch (failure) {
      setFollowError(errorText(failure, "Không cập nhật được lượt theo dõi. Thử lại."));
    } finally {
      followLock.current = false;
      setBusy(false);
    }
  }

  return (
    <>
      <section className="people-panel people-profile" aria-labelledby="people-profile-name">
        <div className="people-cover" aria-hidden="true">
          {profile.bannerUrl && <img src={profile.bannerUrl} alt="" />}
        </div>
        <div className="people-profile-body">
          <div className="people-profile-tools">
            <Avatar person={profile} large />
            <div className="people-actions">
              {self ? (
                <a className="button" href="/settings">
                  Chỉnh sửa hồ sơ
                </a>
              ) : user ? (
                <>
                  <a className="button" href={messageHref(profile.id)}>
                    Nhắn tin
                  </a>
                  <button
                    className={profile.isFollowing ? "button" : "button button-primary"}
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void toggleFollow(profile.id, !profile.isFollowing, profile.isFollowing)
                    }
                  >
                    {busy ? "Đang cập nhật…" : profile.isFollowing ? "Bỏ theo dõi" : "Theo dõi"}
                  </button>
                </>
              ) : (
                <a
                  className="button button-primary"
                  href={`/login?${new URLSearchParams({ next: profileHref(profile.username) })}`}
                >
                  Đăng nhập để theo dõi
                </a>
              )}
            </div>
          </div>
          <h1 id="people-profile-name">{profile.displayName}</h1>
          <p className="people-handle">@{profile.username}</p>
          {profile.bio && <p className="people-bio">{profile.bio}</p>}
          <nav className="people-counts" aria-label="Kết nối">
            <a href={profileHref(profile.username, "followers")}>
              <strong>{number.format(profile.followersCount)}</strong> người theo dõi
            </a>
            <a href={profileHref(profile.username, "following")}>
              <strong>{number.format(profile.followingCount)}</strong> đang theo dõi
            </a>
          </nav>
          {followError && (
            <p className="people-feedback people-error" role="alert">
              {followError}
            </p>
          )}
          <span className="people-sr-only" role="status">
            {notice}
          </span>
        </div>
      </section>
      <UserTimeline username={profile.username} user={user} revision={timelineRevision} />
    </>
  );
}

function PersonRows({ people }: { people: Person[] }) {
  return (
    <ul className="people-list">
      {people.map((person) => (
        <li key={person.id}>
          <a className="people-person" href={profileHref(person.username)}>
            <Avatar person={person} />
            <div className="people-person-text">
              <strong>{person.displayName}</strong>
              <span className="people-handle">@{person.username}</span>
              {person.bio && <p className="people-bio">{person.bio}</p>}
            </div>
            <Icon name="chevron" size={16} className="people-chevron" />
          </a>
        </li>
      ))}
    </ul>
  );
}

function PagedPeople({
  load,
  empty,
}: {
  load: (cursor: string | null, signal: AbortSignal) => Promise<PeoplePage>;
  empty: string;
}) {
  const { value: page, setValue, error, reload } = useResource((signal) => load(null, signal));
  const [moreError, setMoreError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const inFlight = useRef<AbortController | null>(null);
  const restoreEndFocus = useRef(false);
  const endMarker = useRef<HTMLParagraphElement>(null);
  useEffect(() => () => inFlight.current?.abort(), []);
  useEffect(() => {
    // Keep focus in the list when its last “load more” button disappears.
    if (restoreEndFocus.current && !page?.nextCursor && document.activeElement === document.body)
      endMarker.current?.focus();
  }, [page?.nextCursor]);

  async function more(cursor: string) {
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    restoreEndFocus.current = document.activeElement instanceof HTMLButtonElement;
    setLoadingMore(true);
    setMoreError("");
    try {
      const next = await load(cursor, controller.signal);
      if (!controller.signal.aborted) {
        setValue(
          (current) =>
            current && {
              items: uniquePeople(current.items, next.items),
              nextCursor: next.nextCursor === cursor ? null : next.nextCursor,
            },
        );
      }
    } catch (failure) {
      if (!controller.signal.aborted)
        setMoreError(errorText(failure, "Không tải được trang tiếp theo."));
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
      if (!controller.signal.aborted) setLoadingMore(false);
    }
  }

  if (error) return <LoadFailure title="Không tải được danh sách" error={error} retry={reload} />;
  if (!page)
    return (
      <p className="people-state" role="status">
        Đang tải danh sách…
      </p>
    );
  if (page.items.length === 0 && !page.nextCursor) return <p className="people-state">{empty}</p>;
  return (
    <>
      <PersonRows people={page.items} />
      {moreError && (
        <p className="people-state people-error" role="alert">
          {moreError}
        </p>
      )}
      {page.nextCursor ? (
        <div className="people-list-footer">
          <InfiniteScrollSentinel
            enabled={!loadingMore}
            onVisible={() => void more(page.nextCursor!)}
          />
          <button
            className="button"
            type="button"
            aria-disabled={loadingMore}
            onClick={() => void more(page.nextCursor!)}
          >
            {loadingMore ? "Đang tải…" : moreError ? "Thử tải lại" : "Xem thêm"}
          </button>
        </div>
      ) : (
        <p className="people-sr-only" role="status" ref={endMarker} tabIndex={-1}>
          Đã hiển thị {number.format(page.items.length)} người.
        </p>
      )}
    </>
  );
}

function Connections({ username, kind }: { username: string; kind: Connection }) {
  return (
    <section className="people-panel" aria-labelledby="people-list-title">
      <header className="people-section-head">
        <h1 id="people-list-title">{connectionLabels[kind]}</h1>
        <a className="people-back" href={profileHref(username)}>
          Hồ sơ @{username}
        </a>
      </header>
      <nav className="people-tabs" aria-label="Danh sách kết nối">
        {(["followers", "following"] as const).map((item) => (
          <a
            key={item}
            href={profileHref(username, item)}
            aria-current={kind === item ? "page" : undefined}
          >
            {connectionLabels[item]}
          </a>
        ))}
      </nav>
      <PagedPeople
        load={(cursor, signal) => client.connections(username, kind, cursor, signal)}
        empty={kind === "followers" ? "Chưa có người theo dõi." : "Chưa theo dõi ai."}
      />
    </section>
  );
}

function Suggestions({ signedIn }: { signedIn: boolean }) {
  const { value, error, reload } = useResource((signal) => client.suggestions(signedIn, signal));
  if (error) return <LoadFailure title="Không tải được gợi ý" error={error} retry={reload} />;
  if (!value)
    return (
      <p className="people-state" role="status">
        Đang tải gợi ý…
      </p>
    );
  return value.items.length ? (
    <PersonRows people={value.items} />
  ) : (
    <p className="people-state">Chưa có gợi ý mới.</p>
  );
}

function Directory({ query, user }: { query: string; user: User | null }) {
  const [draft, setDraft] = useState(query);
  const [formError, setFormError] = useState("");
  const link = useRef<HTMLAnchorElement>(null);
  const queryProblem = query ? searchProblem(query) : null;

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = draft.trim() ? searchProblem(draft) : null;
    setFormError(problem ?? "");
    // The shell handles internal anchors, including history and back navigation.
    if (!problem && draft.trim() !== query) link.current?.click();
  }

  let results: ReactNode;
  if (!query) results = <Suggestions signedIn={Boolean(user)} />;
  else if (queryProblem)
    results = (
      <p className="people-state people-error" role="alert">
        {queryProblem}
      </p>
    );
  else
    results = (
      <PagedPeople
        load={(cursor, signal) => client.search(query, cursor, signal)}
        empty="Không tìm thấy người dùng phù hợp."
      />
    );

  return (
    <section className="people-panel" aria-labelledby="people-directory-title">
      <header className="people-section-head">
        <h1 id="people-directory-title">Tìm người dùng</h1>
        <form className="people-search" role="search" action="/people" onSubmit={search}>
          <div className="people-search-input">
            <label htmlFor="people-query">Tên hiển thị hoặc tên người dùng</label>
            <input
              id="people-query"
              type="search"
              name="q"
              value={draft}
              maxLength={200}
              aria-invalid={Boolean(formError || queryProblem) || undefined}
              aria-describedby={formError ? "people-query-error" : undefined}
              onChange={(event) => {
                setDraft(event.target.value);
                setFormError("");
              }}
            />
          </div>
          <button className="button button-primary" type="submit">
            Tìm kiếm
          </button>
          <a ref={link} href={peopleHref(draft)} hidden>
            Tìm kiếm
          </a>
        </form>
        {formError && (
          <p id="people-query-error" className="people-feedback people-error" role="alert">
            {formError}
          </p>
        )}
        {query && (
          <a className="people-back" href="/people">
            Xóa tìm kiếm
          </a>
        )}
      </header>
      <h2 className="people-list-title">{query ? `Kết quả cho “${query}”` : "Gợi ý theo dõi"}</h2>
      {results}
    </section>
  );
}

export function People({
  path,
  user,
  onUser,
}: {
  path: string;
  user: User | null;
  onUser: (user: User | null) => void;
}) {
  const route = parsePeoplePath(path);
  const viewer = user?.id ?? "guest";
  let page: ReactNode;
  if (!route)
    page = (
      <section className="people-panel people-state">
        <h1>Không tìm thấy trang</h1>
        <a href="/people">Tìm người dùng</a>
      </section>
    );
  else if (route.kind === "settings")
    page = user ? (
      <Settings key={viewer} client={client} user={user} onUser={onUser} />
    ) : (
      <section className="people-panel people-state">
        <h1>Cài đặt</h1>
        <p>Đăng nhập để quản lý hồ sơ và tài khoản.</p>
        <a className="button button-primary" href="/login?next=%2Fsettings">
          Đăng nhập
        </a>
      </section>
    );
  else if (route.kind === "directory")
    page = (
      <Directory key={JSON.stringify([route.query, viewer])} query={route.query} user={user} />
    );
  else if (route.kind === "profile")
    page = (
      <ProfileView
        key={JSON.stringify([route.username, viewer])}
        username={route.username}
        user={user}
      />
    );
  else
    page = (
      <Connections
        key={JSON.stringify([route.username, route.kind])}
        username={route.username}
        kind={route.kind}
      />
    );
  return <div className="people-area">{page}</div>;
}
