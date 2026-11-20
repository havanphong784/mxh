import { useEffect, useRef, useState } from "react";
import type { Person } from "./contracts";

export function errorText(error: unknown, fallback: string): string {
  if (error instanceof TypeError)
    return "Không kết nối được. Kiểm tra mạng rồi thử lại.";
  return error instanceof Error && error.message ? error.message : fallback;
}

// Callers key each screen by its data identity. Retry is the only reason to reload within that screen.
export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const request = useRef(load);
  useEffect(() => {
    const controller = new AbortController();
    request
      .current(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setValue(result);
      })
      .catch((failure) => {
        if (!controller.signal.aborted)
          setError(errorText(failure, "Không tải được dữ liệu."));
      });
    return () => controller.abort();
  }, [attempt]);
  return {
    value,
    setValue,
    error,
    reload: () => {
      setError("");
      setValue(null);
      setAttempt((n) => n + 1);
    },
  };
}

export function LoadFailure({
  title,
  error,
  retry,
}: {
  title: string;
  error: string;
  retry: () => void;
}) {
  return (
    <div className="people-state">
      <div role="alert">
        <strong>{title}</strong>
        <p>{error}</p>
      </div>
      <button className="button" type="button" onClick={retry}>
        Thử lại
      </button>
    </div>
  );
}

export function Avatar({ person, large }: { person: Person; large?: boolean }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const initial =
    Array.from(
      person.displayName.trim() || person.username,
    )[0]?.toLocaleUpperCase("vi") ?? "";
  return (
    <div
      className={`people-avatar${large ? " people-avatar-large" : ""}`}
      aria-hidden="true"
    >
      {person.avatarUrl && failedUrl !== person.avatarUrl ? (
        <img
          src={person.avatarUrl}
          alt=""
          onError={() => setFailedUrl(person.avatarUrl ?? null)}
        />
      ) : (
        initial
      )}
    </div>
  );
}
