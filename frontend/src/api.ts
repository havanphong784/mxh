export type AuthSyncMessage =
  | { type: "request-token"; requestId: string; rejectedToken?: string; sourceId?: string }
  | { type: "token"; requestId?: string; token: string; sourceId?: string }
  | { type: "session-changed"; sourceId?: string }
  | { type: "session-ended"; sourceId?: string };

export type AuthSync = {
  publish(message: AuthSyncMessage): void;
  subscribe(listener: (message: AuthSyncMessage) => void): () => void;
};

type SessionInvalidationReason = "expired" | "peer";

function createBrowserAuthSync(): AuthSync | undefined {
  if (typeof window === "undefined" || typeof window.BroadcastChannel === "undefined")
    return undefined;
  const channel = new window.BroadcastChannel("mxh-auth");
  return {
    publish(message) {
      channel.postMessage(message);
    },
    subscribe(listener) {
      const receive = (event: MessageEvent<AuthSyncMessage>) => listener(event.data);
      channel.addEventListener("message", receive);
      return () => channel.removeEventListener("message", receive);
    },
  };
}

function tokenClaims(token: string): { sub?: string; sessionId?: string; exp?: number } | null {
  const encoded = token.split(".")[1];
  if (!encoded) return null;
  try {
    const json = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as unknown;
    if (!claims || typeof claims !== "object") return null;
    const value = claims as Record<string, unknown>;
    return {
      sub: typeof value.sub === "string" ? value.sub : undefined,
      sessionId: typeof value.sessionId === "string" ? value.sessionId : undefined,
      exp: typeof value.exp === "number" ? value.exp : undefined,
    };
  } catch {
    return null;
  }
}

function isUsableToken(token: string, now = Date.now()): boolean {
  const exp = tokenClaims(token)?.exp;
  return exp === undefined || exp * 1000 > now;
}

function sameSession(left: string, right: string): boolean {
  if (left === right) return true;
  const a = tokenClaims(left);
  const b = tokenClaims(right);
  // Refresh rotation creates a new server session ID for the same subject.
  // Explicit login/logout is carried separately by session lifecycle messages.
  return Boolean(a?.sub && a.sub === b?.sub);
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
  idempotencyKey?: string;
}

export type ApiErrorDetails = {
  code?: string;
  errors?: string[];
  requestId?: string;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly errors?: string[];
  readonly requestId?: string;

  constructor(status: number, message: string, details: ApiErrorDetails = {}) {
    super(message);
    this.status = status;
    this.code = details.code;
    this.errors = details.errors;
    this.requestId = details.requestId;
    this.name = "ApiError";
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    if (response.ok) throw new ApiError(502, "Máy chủ trả về dữ liệu không hợp lệ.");
  }
  if (!response.ok) {
    const envelope = payload as
      | {
          message?: unknown;
          code?: unknown;
          errors?: unknown;
          requestId?: unknown;
        }
      | undefined;
    const raw = envelope?.message;
    const errors = Array.isArray(envelope?.errors)
      ? envelope.errors.filter((item): item is string => typeof item === "string")
      : Array.isArray(raw)
        ? raw.filter((item): item is string => typeof item === "string")
        : undefined;
    const message = Array.isArray(raw) ? errors?.join(" · ") : raw;
    throw new ApiError(
      response.status,
      typeof message === "string" && message
        ? message
        : `Không thể hoàn tất yêu cầu (${response.status}).`,
      {
        code: typeof envelope?.code === "string" ? envelope.code : undefined,
        errors: errors?.length ? errors : undefined,
        requestId:
          typeof envelope?.requestId === "string"
            ? envelope.requestId
            : (response.headers.get("x-request-id") ?? undefined),
      },
    );
  }
  return payload as T;
}

export function createClient(
  origin: string,
  transport: typeof fetch = fetch,
  providedAuthSync?: AuthSync,
) {
  const prefix = `${origin.replace(/\/$/, "")}/api/v1`;
  const authSync = providedAuthSync ?? createBrowserAuthSync();
  const sourceId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let token: string | null = null;
  let generation = 0;
  let flight: Promise<string | null> | null = null;
  let requestSequence = 0;
  const peerWaiters = new Map<string, (peerToken: string | null) => void>();
  const expired = new Set<(reason: SessionInvalidationReason) => void>();
  const pendingControllers = new Set<AbortController>();
  const publish = (message: AuthSyncMessage) => authSync?.publish({ ...message, sourceId });
  const publishToken = (next: string, requestId?: string) =>
    publish({ type: "token", requestId, token: next });
  const adoptPeerToken = (next: string) => {
    if (!isUsableToken(next) || (token && !sameSession(token, next))) return false;
    token = next;
    return true;
  };
  const notifyInvalidated = (reason: SessionInvalidationReason) => {
    for (const controller of pendingControllers) controller.abort();
    generation++;
    token = null;
    flight = null;
    for (const waiter of peerWaiters.values()) waiter(null);
    peerWaiters.clear();
    expired.forEach((fn) => {
      fn(reason);
    });
  };
  const unsubscribeAuthSync = authSync?.subscribe((message) => {
    if (message.sourceId === sourceId) return;
    if (message.type === "request-token") {
      if (token && isUsableToken(token) && token !== message.rejectedToken)
        publishToken(token, message.requestId);
      return;
    }
    if (message.type === "session-changed" || message.type === "session-ended") {
      notifyInvalidated("peer");
      return;
    }
    const requestId = message.requestId;
    const waiter = requestId ? peerWaiters.get(requestId) : undefined;
    if (waiter) {
      waiter(message.token);
      return;
    }
    // An unsolicited token is only a refresh for the already known session. A
    // session-change event deliberately clears the old tab and must not hand it
    // the newly logged-in account's token by accident.
    if (token) adoptPeerToken(message.token);
  });
  const setToken = (next: string | null) => {
    const previous = token;
    generation++;
    token = next;
    flight = null;
    if (next && next !== previous) {
      publish({ type: "session-changed" });
      publishToken(next);
    } else if (!next && previous) {
      publish({ type: "session-ended" });
    } else if (next) {
      publishToken(next);
    }
  };

  function requestPeerToken(rejectedToken?: string): Promise<string | null> {
    if (!authSync) return Promise.resolve(null);
    const requestId = `auth-${sourceId}-${requestSequence++}`;
    const session = generation;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        peerWaiters.delete(requestId);
        resolve(null);
      }, 50);
      peerWaiters.set(requestId, (peerToken) => {
        if (
          peerToken !== null &&
          (session !== generation || peerToken === rejectedToken || !adoptPeerToken(peerToken))
        )
          return;
        peerWaiters.delete(requestId);
        clearTimeout(timeout);
        resolve(peerToken);
      });
      publish({ type: "request-token", requestId, rejectedToken });
    });
  }

  function refreshAfterUnauthorized(rejectedToken?: string): Promise<string | null> {
    if (flight) return flight;
    const session = generation;
    const excludedToken = rejectedToken ?? token ?? undefined;
    const assertSession = () => {
      if (session !== generation) throw new DOMException("Phiên đăng nhập đã đổi.", "AbortError");
    };
    const candidate = () =>
      token && token !== excludedToken && isUsableToken(token) ? token : null;
    const rotate = async () => {
      assertSession();
      if (candidate()) return candidate();
      // A cold tab may have missed the broadcast while waiting for the lock.
      const peerToken = await requestPeerToken(excludedToken);
      assertSession();
      if (peerToken) return peerToken;
      const response = await transport(`${prefix}/auth/refresh`, {
        method: "POST",
        credentials: "include",
        signal: AbortSignal.timeout(10_000),
      });
      assertSession();
      if (response.status === 401 || response.status === 403) {
        notifyInvalidated("expired");
        return null;
      }
      const result = await readResponse<{ accessToken?: string }>(response);
      assertSession();
      if (!result?.accessToken) throw new ApiError(502, "Không nhận được phiên đăng nhập.");
      if (token && tokenClaims(token)?.sub && !sameSession(token, result.accessToken)) {
        notifyInvalidated("peer");
        throw new DOMException("Phiên đăng nhập đã đổi.", "AbortError");
      }
      token = result.accessToken;
      publishToken(token);
      return token;
    };
    const pending = Promise.resolve()
      .then(async () => {
        const peerToken = await requestPeerToken(excludedToken);
        assertSession();
        if (peerToken) return peerToken;
        const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
        return locks
          ? locks.request("mxh-auth-refresh", { signal: AbortSignal.timeout(10_000) }, rotate)
          : rotate();
      })
      .finally(() => {
        if (flight === pending) flight = null;
      });
    flight = pending;
    return pending;
  }

  function refresh(): Promise<string | null> {
    return refreshAfterUnauthorized();
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//"))
      throw new TypeError("Expected an API-relative path");
    const { body, method = "GET", signal, idempotencyKey, auth = true } = options;
    const initialToken = auth ? token : null;
    const session = generation;
    const controller = new AbortController();
    const abortExternal = () => controller.abort();
    if (signal?.aborted) controller.abort();
    else signal?.addEventListener("abort", abortExternal, { once: true });
    if (auth) pendingControllers.add(controller);
    const send = (access: string | null) => {
      const headers = new Headers({ Accept: "application/json" });
      if (access) headers.set("Authorization", `Bearer ${access}`);
      if (body !== undefined) headers.set("Content-Type", "application/json");
      if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
      return transport(`${prefix}${path}`, {
        method,
        credentials: "include",
        signal: controller.signal,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    };
    try {
      let response = await send(initialToken);
      if (auth && initialToken && response.status === 401 && session === generation) {
        const access =
          token !== initialToken ? token : await refreshAfterUnauthorized(initialToken);
        signal?.throwIfAborted();
        if (!access) return readResponse<T>(response);
        if (session === generation && !controller.signal.aborted) {
          response = await send(access);
          if (response.status === 401 && session === generation) {
            notifyInvalidated("expired");
            return readResponse<T>(response);
          }
        }
      }
      if (auth && initialToken && session !== generation)
        throw new DOMException("Phiên đăng nhập đã đổi.", "AbortError");
      const value = await readResponse<T>(response);
      if (auth && initialToken && session !== generation)
        throw new DOMException("Phiên đăng nhập đã đổi.", "AbortError");
      return value;
    } finally {
      signal?.removeEventListener("abort", abortExternal);
      pendingControllers.delete(controller);
    }
  }

  return {
    setToken,
    getToken: () => token,
    refresh,
    request,
    onExpired(callback: (reason: SessionInvalidationReason) => void) {
      expired.add(callback);
      return () => {
        expired.delete(callback);
      };
    },
    dispose() {
      unsubscribeAuthSync?.();
      for (const controller of pendingControllers) controller.abort();
      pendingControllers.clear();
    },
  };
}

export const apiOrigin = (import.meta.env?.VITE_API_ORIGIN ?? "").replace(/\/$/, "");
export const sessionClient = createClient(apiOrigin);
export const api = sessionClient.request;
