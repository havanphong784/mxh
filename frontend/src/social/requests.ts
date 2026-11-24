import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import { appendPage, isActive, mergePostChange, pagePath } from "./model";
import type { Page, Post, PostChange, PostLikesPage, Toggle } from "./model";

export function readPostLikes(
  postId: string,
  cursor: string | null,
  auth: boolean,
  signal: AbortSignal,
) {
  return api<PostLikesPage>(
    pagePath(`/posts/${encodeURIComponent(postId)}/likes`, cursor),
    {
      auth,
      signal,
    },
  );
}

export function errorLabel(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  // Keep Vietnamese domain messages; do not surface HTTP, transport or provider internals.
  return /[À-ỹ]/u.test(message) && message.length < 280 ? message : fallback;
}

export function useQuery<T>(endpoint: string | undefined, auth: boolean) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(endpoint));
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!endpoint) return;
    const request = new AbortController();
    setLoading(true);
    setError("");
    api<T>(endpoint, { auth, signal: request.signal })
      .then((value) => {
        if (!request.signal.aborted) setData(value);
      })
      .catch((failure: unknown) => {
        if (!request.signal.aborted)
          setError(
            errorLabel(failure, "Không tải được nội dung. Vui lòng thử lại."),
          );
      })
      .finally(() => {
        if (!request.signal.aborted) setLoading(false);
      });
    return () => request.abort();
  }, [endpoint, auth, retry]);
  return {
    data,
    setData,
    error,
    loading,
    reload: () => setRetry((value) => value + 1),
  };
}

type PageState = {
  items: Post[];
  next: string | null;
  status: "loading" | "ready" | "more" | "error" | "more-error";
  error: string;
};
const initial: PageState = {
  items: [],
  next: null,
  status: "loading",
  error: "",
};

export function usePostPages(
  endpoint: string,
  auth: boolean,
  tombstone = false,
  collection?: Toggle,
) {
  const [page, setPage] = useState<PageState>(initial);
  const pending = useRef<AbortController | null>(null);
  const journal = useRef<PostChange[]>([]);
  const inserted = useRef<Post[]>([]);
  const next = useRef<string | null>(null);
  const started = useRef(false);

  const update = useCallback(
    (post: Post, change: PostChange): Post[] => {
      const value = mergePostChange(post, change, tombstone);
      if (!value) return [];
      if (
        change.kind === "toggle" &&
        change.action === collection &&
        !change.active &&
        (post.id === change.id ||
          (isActive(post) && post.repostOfId === change.id))
      )
        return [];
      return [value];
    },
    [collection, tombstone],
  );

  const load = useCallback(
    async (first = false) => {
      if (pending.current || (!first && !next.current)) return false;
      const cursor = first ? null : next.current;
      const request = new AbortController();
      pending.current = request;
      setPage((current) => ({
        ...current,
        status: first ? "loading" : "more",
        error: "",
      }));
      try {
        const response = await api<Page>(pagePath(endpoint, cursor), {
          auth,
          signal: request.signal,
        });
        if (request.signal.aborted) return false;
        const rows = journal.current.reduce(
          (items, change) => items.flatMap((post) => update(post, change)),
          response.items,
        );
        const incoming = first ? appendPage(inserted.current, rows) : rows;
        next.current =
          response.nextCursor === cursor ? null : response.nextCursor;
        started.current = true;
        const nextCursor = next.current;
        setPage((current) => ({
          items: first ? incoming : appendPage(current.items, incoming),
          next: nextCursor,
          status: "ready",
          error: "",
        }));
        return true;
      } catch (failure) {
        if (!request.signal.aborted)
          setPage((current) => ({
            ...current,
            status: first ? "error" : "more-error",
            error: errorLabel(
              failure,
              "Không tải được bài viết. Vui lòng thử lại.",
            ),
          }));
        return false;
      } finally {
        if (pending.current === request) pending.current = null;
      }
    },
    [auth, endpoint, update],
  );
  useEffect(() => {
    void load(true);
    return () => {
      pending.current?.abort();
      pending.current = null;
    };
    // Callers key this hook's host by endpoint and viewer.
  }, [load]);

  return {
    page,
    loadMore: () => void load(!started.current),
    reload: () => load(true),
    apply(change: PostChange) {
      journal.current.push(change);
      inserted.current = inserted.current.flatMap((post) =>
        update(post, change),
      );
      setPage((current) => ({
        ...current,
        items: current.items.flatMap((post) => update(post, change)),
      }));
    },
    prepend(post: Post) {
      inserted.current = [
        post,
        ...inserted.current.filter((item) => item.id !== post.id),
      ];
      setPage((current) => ({
        ...current,
        items: [post, ...current.items.filter((item) => item.id !== post.id)],
      }));
    },
  };
}
