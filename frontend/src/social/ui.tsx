import { useState } from "react";
import type { ReactNode } from "react";
import { Icon as SharedIcon } from "../icons";
import { VISIBILITIES } from "./model";
import type { Author, Media, Visibility } from "./model";

export function Icon({ name, active = false }: { name: string; active?: boolean }) {
  return <SharedIcon name={name} size={20} active={active} />;
}

export function Avatar({ user }: { user: Author }) {
  const [failed, setFailed] = useState(false);
  const initial = Array.from(user.displayName.trim() || user.username)[0] ?? "?";
  return (
    <span className="social-avatar" aria-hidden="true">
      {user.avatarUrl && !failed ? (
        <img src={user.avatarUrl} alt="" loading="lazy" onError={() => setFailed(true)} />
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

export function MediaView({ media, priority = false }: { media: Media[]; priority?: boolean }) {
  if (!media.length) return null;
  return (
    <div className="social-media" data-multiple={media.length > 1}>
      {[...media]
        .sort((a, b) => a.order - b.order)
        .map((item, index) => {
          const label = `${item.type === "IMAGE" ? "Ảnh" : item.type === "AUDIO" ? "Âm thanh" : "Video"} đính kèm ${index + 1}`;
          if (item.type === "AUDIO")
            return (
              <audio key={item.id} controls preload="none" aria-label={label} src={item.url} />
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
                loading={priority && index === 0 ? "eager" : "lazy"}
                fetchPriority={priority && index === 0 ? "high" : "auto"}
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
