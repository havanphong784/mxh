import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { searchPeople, startDirect, threadHref } from "./data";
import { usePages, useWrite } from "./use-inbox";
import { Avatar, Icon, Pager, Status } from "./ui";

export function Compose({ to, userId }: { to: string | null; userId: string }) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState<{ query: string; run: number } | null>(
    null,
  );
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const nextLink = useRef<HTMLAnchorElement>(null);
  const write = useWrite();
  useEffect(() => {
    if (open) nextLink.current?.click();
  }, [open]);

  function start(target: string) {
    if (starting || open || target === userId) return;
    setStarting(target);
    setError("");
    void write(
      (signal) => startDirect(target, signal),
      (conversation) => {
        setOpen(threadHref(conversation.id));
        setStarting(null);
      },
      () => {
        setError(
          "Không thể mở cuộc trò chuyện với người này. Hãy thử lại hoặc chọn người khác.",
        );
        setStarting(null);
      },
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const query = input.trim();
    if (query.length < 2 || query.length > 100) return;
    setError("");
    setSearch((previous) => ({ query, run: (previous?.run ?? 0) + 1 }));
  }

  return (
    <section
      className="mx-inbox-panel"
      aria-labelledby="mx-inbox-compose-title"
    >
      <header className="mx-inbox-panel-head">
        <a
          className="button mx-inbox-back"
          href="/messages"
          aria-label="Về danh sách trò chuyện"
        >
          <Icon name="back" />
        </a>
        <h2 id="mx-inbox-compose-title">Tin nhắn mới</h2>
      </header>
      <div className="mx-inbox-compose">
        {to && (
          <div className="mx-inbox-target">
            {to === userId ? (
              <p>Bạn không thể nhắn tin cho chính mình.</p>
            ) : (
              <>
                <p>
                  Mở cuộc trò chuyện với người bạn đã chọn từ trang cá nhân.
                </p>
                <button
                  className="button button-primary"
                  type="button"
                  disabled={!!starting || !!open}
                  onClick={() => start(to)}
                >
                  <Icon name="message" />{" "}
                  {starting === to ? "Đang mở…" : "Mở cuộc trò chuyện"}
                </button>
              </>
            )}
          </div>
        )}
        <form className="mx-inbox-form" onSubmit={submit}>
          <label htmlFor="mx-inbox-search">Tìm người nhận</label>
          <input
            id="mx-inbox-search"
            type="search"
            placeholder="Tên hiển thị hoặc tên người dùng"
            value={input}
            maxLength={100}
            onChange={(event) => setInput(event.target.value)}
          />
          <button
            type="submit"
            className="button"
            disabled={input.trim().length < 2 || !!starting}
          >
            <Icon name="search" /> Tìm
          </button>
        </form>
        {error && (
          <p className="mx-inbox-error" role="alert">
            {error}
          </p>
        )}
        {open && (
          <p>
            <a ref={nextLink} className="button button-primary" href={open}>
              Đi đến cuộc trò chuyện
            </a>
          </p>
        )}
      </div>
      {search && (
        <SearchResults
          key={search.run}
          query={search.query}
          userId={userId}
          start={start}
          starting={starting}
          opened={!!open}
        />
      )}
    </section>
  );
}

function SearchResults({
  query,
  userId,
  start,
  starting,
  opened,
}: {
  query: string;
  userId: string;
  start: (person: string) => void;
  starting: string | null;
  opened: boolean;
}) {
  const load = useCallback(
    (cursor: string | null, signal: AbortSignal) =>
      searchPeople(query, cursor, signal),
    [query],
  );
  const results = usePages(load);
  const people = results.page?.items.filter((person) => person.id !== userId);
  return (
    <>
      {!people && !results.failure && <Status text="Đang tìm người dùng…" />}
      {people?.length === 0 && (
        <Status text="Không tìm thấy người nhận phù hợp." />
      )}
      {people && people.length > 0 && (
        <ul className="mx-inbox-list" aria-label="Kết quả tìm người nhận">
          {people.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                className="mx-inbox-row mx-inbox-result"
                onClick={() => start(person.id)}
                disabled={!!starting || opened}
              >
                <Avatar person={person} />
                <span className="mx-inbox-person">
                  <strong>{person.displayName || person.username}</strong>
                  <span>@{person.username}</span>
                </span>
                {starting === person.id ? (
                  <span>Đang mở…</span>
                ) : (
                  <Icon name="message" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      <Pager {...results} cursor={results.page?.cursor} />
    </>
  );
}
