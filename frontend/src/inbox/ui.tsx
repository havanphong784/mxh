import { useState } from "react";
import type { User } from "../session";
import { InfiniteScrollSentinel } from "../infinite-scroll";
import { Icon as SharedIcon } from "../icons";

export function Icon({ name, active = false }: { name: string; active?: boolean }) {
  return <SharedIcon name={name} size={19} active={active} />;
}

export function Avatar({ person }: { person: User | null }) {
  return <AvatarImage key={person?.avatarUrl ?? person?.id} person={person} />;
}
function AvatarImage({ person }: { person: User | null }) {
  const [broken, setBroken] = useState(false);
  const initial = [...(person?.displayName.trim() || person?.username || "?")][0].toLocaleUpperCase(
    "vi",
  );
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
    <time dateTime={value} title={fullDate.format(date)} aria-label={fullDate.format(date)}>
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
    return <Status text="Không thể cập nhật. Vui lòng thử lại." retry={reload} />;
  if (failure === "more") return <Status text="Không thể tải thêm." retry={more} />;
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
