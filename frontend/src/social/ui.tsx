import { useState } from "react";
import type { ReactNode } from "react";
import { VISIBILITIES } from "./model";
import type { Author, Media, Visibility } from "./model";

const paths = {
  heart:
    "M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 1 0-7.6 7.6l1.2 1.2 7.6 7.6 8.8-8.8a5.4 5.4 0 0 0 0-7.6Z",
  bookmark: "M6 4h12v17l-6-4-6 4V4Z",
  repost:
    "m17 2 4 4-4 4M3 11V8a2 2 0 0 1 2-2h16M7 22l-4-4 4-4m14-1v3a2 2 0 0 1-2 2H3",
  reply:
    "M21 11.5a8.4 8.4 0 0 1-9 8.5 9.3 9.3 0 0 1-3.4-.7L3 21l1.6-4.2A8.3 8.3 0 0 1 3 11.5a9 9 0 0 1 18 0Z",
  quote: "M10 5H4v8h5c0 3-1.2 4.5-4 5.5M21 5h-6v8h5c0 3-1.2 4.5-4 5.5",
  pen: "m14.5 5.5 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z",
  trash: "M4 7h16m-10 4v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3",
  search: "M20 20l-5-5m2-5a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
  arrow: "M4 12h15m-6-6 6 6-6 6",
  back: "M20 12H5m6-6-6 6 6 6",
  clip: "M9 13l6-6a3 3 0 1 1 4.2 4.2l-8.5 8.5a5 5 0 0 1-7.1-7.1L12 4.2",
  close: "m6 6 12 12M18 6 6 18",
  more: "M5 12h.01m6.99 0h.01m6.99 0h.01",
  post: "M5 4h14v16H5Zm3 4h8m-8 4h8m-8 4h4",
  image: "M4 4h16v16H4Zm0 13 5-5 4 4 3-3 4 4M15 8h.01",
  check: "m5 12 4 4L19 6",
} as const;
export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={name === "more" ? 3.25 : 1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function Avatar({ user }: { user: Author }) {
  const [failed, setFailed] = useState(false);
  const initial =
    Array.from(user.displayName.trim() || user.username)[0] ?? "?";
  return (
    <span className="social-avatar" aria-hidden="true">
      {user.avatarUrl && !failed ? (
        <img
          src={user.avatarUrl}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        initial.toLocaleUpperCase("vi")
      )}
    </span>
  );
}

export function VisibilityPicker({
  value,
  onChange,
  disabled,
}: {
  value: Visibility;
  onChange: (value: Visibility) => void;
  disabled?: boolean;
}) {
  return (
    <label className="social-visibility">
      <span>Ai có thể xem?</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value as Visibility)}
      >
        {Object.entries(VISIBILITIES).map(([visibility, label]) => (
          <option key={visibility} value={visibility}>
            {label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Message({
  title,
  children,
  action,
  error = false,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  error?: boolean;
}) {
  return (
    <div className={`social-state${error ? " social-state-error" : ""}`}>
      <div role={error ? "alert" : "status"}>
        <strong>{title}</strong>
        {children && <p>{children}</p>}
      </div>
      {action && <div className="social-state-actions">{action}</div>}
    </div>
  );
}

export function Loading({ label = "Đang tải bài viết…" }: { label?: string }) {
  return (
    <p className="social-loading" role="status">
      <span aria-hidden="true" />
      {label}
    </p>
  );
}

export function MediaView({ media }: { media: Media[] }) {
  if (!media.length) return null;
  return (
    <div className="social-media" data-multiple={media.length > 1}>
      {[...media]
        .sort((a, b) => a.order - b.order)
        .map((item, index) => {
          const label = `${item.type === "IMAGE" ? "Ảnh" : item.type === "AUDIO" ? "Âm thanh" : "Video"} đính kèm ${index + 1}`;
          if (item.type === "AUDIO")
            return (
              <audio
                key={item.id}
                controls
                preload="none"
                aria-label={label}
                src={item.url}
              />
            );
          if (item.type === "VIDEO")
            return (
              <video
                key={item.id}
                controls
                playsInline
                preload="metadata"
                aria-label={label}
                src={item.url}
              />
            );
          return (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Mở ${label.toLowerCase()} trong thẻ mới`}
            >
              <img
                src={item.url}
                loading="lazy"
                decoding="async"
                width={item.width || undefined}
                height={item.height || undefined}
                alt={label}
              />
            </a>
          );
        })}
    </div>
  );
}
