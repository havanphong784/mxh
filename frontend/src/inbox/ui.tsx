import { useState } from "react";
import type { User } from "../session";
import { InfiniteScrollSentinel } from "../infinite-scroll";

type IconName =
  "message" | "bell" | "write" | "back" | "search" | "check" | "send";
const strokes: Record<IconName, string> = {
  message: "M20 11.5a7.5 7.5 0 0 1-7.5 7.5H5l1.5-3A7.5 7.5 0 1 1 20 11.5Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-2 7-2 9h16c0-2-2-2-2-9m-8 12a2 2 0 0 0 4 0",
  write: "m13 6 5 5M4 20l4-.8L20 7l-4-4L4 15.2V20Z",
  back: "M19 12H5m6 6-6-6 6-6",
  search: "m16 16 4 4M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13Z",
  check: "m4 12 5 5 11-11",
  send: "m21 3-7 18-4-7-7-4 18-7ZM21 3 10 14",
};
export function Icon({ name }: { name: IconName }) {
  return (
    <svg
      aria-hidden="true"
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={strokes[name]} />
    </svg>
  );
}

export function Avatar({ person }: { person: User | null }) {
  return <AvatarImage key={person?.avatarUrl ?? person?.id} person={person} />;
}
function AvatarImage({ person }: { person: User | null }) {
  const [broken, setBroken] = useState(false);
  const initial = [
    ...(person?.displayName.trim() || person?.username || "?"),
  ][0].toLocaleUpperCase("vi");
  return (
    <span className="mx-inbox-avatar" aria-hidden="true">
      {person?.avatarUrl && !broken ? (
        <img src={person.avatarUrl} alt="" onError={() => setBroken(true)} />
      ) : (
        initial
      )}
    </span>
  );
}

const shortDate = new Intl.DateTimeFormat("vi-VN", {
  day: "numeric",
  month: "short",
});
const clock = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
});
const fullDate = new Intl.DateTimeFormat("vi-VN", {
  dateStyle: "long",
  timeStyle: "short",
});
export function Time({ value }: { value: string }) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return null;
  return (
    <time
      dateTime={value}
      title={fullDate.format(date)}
      aria-label={fullDate.format(date)}
    >
      {date.toDateString() === new Date().toDateString()
        ? clock.format(date)
        : shortDate.format(date)}
    </time>
  );
}

export function Status({ text, retry }: { text: string; retry?: () => void }) {
  return (
    <div className="mx-inbox-status">
      <p role="status">{text}</p>
      {retry && (
        <button type="button" className="button" onClick={retry}>
          Thử lại
        </button>
      )}
    </div>
  );
}

export function Pager({
  cursor,
  busy,
  failure,
  more,
  reload,
  label = "Tải thêm",
  root,
  rootMargin,
}: {
  cursor?: string | null;
  busy: "refresh" | "more" | null;
  failure: "refresh" | "more" | null;
  more: () => void;
  reload: () => void;
  label?: string;
  root?: Element | null;
  rootMargin?: string;
}) {
  if (failure === "refresh")
    return (
      <Status text="Không thể cập nhật. Vui lòng thử lại." retry={reload} />
    );
  if (failure === "more")
    return <Status text="Không thể tải thêm." retry={more} />;
  if (!cursor) return null;
  return (
    <div className="mx-inbox-pager">
      <InfiniteScrollSentinel
        enabled={!busy && !!cursor}
        onVisible={more}
        root={root}
        rootMargin={rootMargin}
      />
      <button type="button" className="button" disabled={!!busy} onClick={more}>
        {busy === "more" ? "Đang tải…" : label}
      </button>
    </div>
  );
}
