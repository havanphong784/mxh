import { useCallback, useEffect, useRef, useState } from "react";
import { mergeById, readWindow, realtimeImpact } from "./model";
import type { Page, WindowPage } from "./model";

type Work = "refresh" | "more";

export function usePages<T extends { id: string }>(
  load: (cursor: string | null, signal: AbortSignal) => Promise<Page<T>>,
  revision = 0,
  prepend = false,
) {
  const [page, setPage] = useState<WindowPage<T> | null>(null);
  const [busy, setBusy] = useState<Work | null>("refresh");
  const [failure, setFailure] = useState<Work | null>(null);
  const [retry, setRetry] = useState(0);
  const depth = useRef(1);
  const active = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    active.current?.abort();
    active.current = controller;
    setBusy("refresh");
    setFailure(null);
    const pagesToReload = depth.current;
    void readWindow(
      (cursor) => load(cursor, controller.signal),
      pagesToReload,
      prepend,
    )
      .then((result) => {
        if (!controller.signal.aborted) setPage(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailure("refresh");
      })
      .finally(() => {
        if (active.current === controller) {
          active.current = null;
          if (!controller.signal.aborted) setBusy(null);
        }
      });
    return () => {
      active.current?.abort();
      active.current = null;
    };
  }, [load, revision, retry, prepend]);

  function more() {
    const cursor = page?.cursor;
    if (!cursor || active.current || failure === "refresh") return;
    const controller = new AbortController();
    active.current = controller;
    setBusy("more");
    setFailure(null);
    void load(cursor, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setPage(
          (current) =>
            current && {
              items: prepend
                ? mergeById(result.items, current.items)
                : mergeById(current.items, result.items),
              cursor: result.cursor,
              depth: current.depth + 1,
            },
        );
        depth.current = page.depth + 1;
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailure("more");
      })
      .finally(() => {
        if (active.current === controller) {
          active.current = null;
          if (!controller.signal.aborted) setBusy(null);
        }
      });
  }

  return {
    page,
    busy,
    failure,
    more,
    reload: () => setRetry((value) => value + 1),
    update: (change: (items: T[]) => T[]) =>
      setPage(
        (current) => current && { ...current, items: change(current.items) },
      ),
  };
}

export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  revision = 0,
) {
  const [value, setValue] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    void load(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setValue(result);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [load, revision, retry]);
  return { value, failed, reload: () => setRetry((value) => value + 1) };
}

const empty = { counts: 0, messages: 0, thread: 0, notifications: 0 };
type Revisions = typeof empty;
type Invalidation = Partial<Record<keyof Revisions, boolean>>;
export function useInboxRevisions(threadId?: string) {
  const currentThread = useRef(threadId);
  useEffect(() => {
    currentThread.current = threadId;
  }, [threadId]);
  const [revisions, setRevisions] = useState(empty);
  const invalidate = useCallback((targets: Invalidation) => {
    setRevisions((previous) => ({
      counts: previous.counts + Number(!!targets.counts),
      messages: previous.messages + Number(!!targets.messages),
      thread: previous.thread + Number(!!targets.thread),
      notifications: previous.notifications + Number(!!targets.notifications),
    }));
  }, []);
  useEffect(() => {
    let timer: number | undefined;
    let pending: Invalidation = {};
    function receive(raw: Event) {
      const detail = (raw as CustomEvent<{ event: string; data: unknown }>)
        .detail;
      if (!detail) return;
      const impact = realtimeImpact(
        detail.event,
        detail.data,
        currentThread.current,
      );
      if (!impact) return;
      for (const key of Object.keys(impact) as (keyof Revisions)[]) {
        if (impact[key]) pending[key] = true;
      }
      if (timer === undefined)
        timer = window.setTimeout(() => {
          invalidate(pending);
          timer = undefined;
          pending = {};
        }, 120);
    }
    window.addEventListener("mxh:realtime", receive);
    return () => {
      window.removeEventListener("mxh:realtime", receive);
      window.clearTimeout(timer);
    };
  }, [invalidate]);
  return { revisions, invalidate };
}

export function useWrite() {
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );
  return useCallback(
    async <T>(
      request: (signal: AbortSignal) => Promise<T>,
      success: (result: T) => void,
      fail: () => void,
    ) => {
      if (active.current) return;
      const controller = new AbortController();
      active.current = controller;
      try {
        const result = await request(controller.signal);
        if (!controller.signal.aborted) success(result);
      } catch {
        if (!controller.signal.aborted) fail();
      } finally {
        if (active.current === controller) active.current = null;
      }
    },
    [],
  );
}
