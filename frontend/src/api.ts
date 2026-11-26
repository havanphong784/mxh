export type AuthSyncMessage =
  | { type: "request-token"; requestId: string }
  | { type: "token"; requestId?: string; token: string };

export type AuthSync = {
  publish(message: AuthSyncMessage): void;
  subscribe(listener: (message: AuthSyncMessage) => void): () => void;
};

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
  let token: string | null = null;
  let generation = 0;
  let flight: Promise<string | null> | null = null;
  let requestSequence = 0;
  const peerWaiters = new Map<string, (peerToken: string) => void>();
  const expired = new Set<() => void>();
  const publishToken = (next: string) => authSync?.publish({ type: "token", token: next });
  const adoptPeerToken = (next: string) => {
    if (next === token) return;
    generation++;
    token = next;
    flight = null;
  };
  const unsubscribeAuthSync = authSync?.subscribe((message) => {
    if (message.type === "request-token") {
      if (token) authSync?.publish({ type: "token", requestId: message.requestId, token });
      return;
    }
    const waiter = message.requestId ? peerWaiters.get(message.requestId) : undefined;
    if (waiter) {
      peerWaiters.delete(message.requestId!);
      adoptPeerToken(message.token);
      waiter(message.token);
      return;
    }
    adoptPeerToken(message.token);
  });
  const setToken = (next: string | null) => {
    generation++;
    token = next;
    flight = null;
    if (next) publishToken(next);
  };

  function requestPeerToken(): Promise<string | null> {
    if (!authSync) return Promise.resolve(null);
    const requestId = `auth-${Date.now()}-${requestSequence++}`;
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        peerWaiters.delete(requestId);
        resolve(null);
      }, 50);
      peerWaiters.set(requestId, (peerToken) => {
        clearTimeout(timeout);
        resolve(peerToken);
      });
      authSync.publish({ type: "request-token", requestId });
    });
  }

  function refresh(): Promise<string | null> {
    if (flight) return flight;
    const session = generation;
    const pending = Promise.resolve()
      .then(async () => {
        const peerToken = await requestPeerToken();
        if (peerToken) return peerToken;
        if (session !== generation) return token;
        const response = await transport(`${prefix}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (session !== generation) return token;
        if (response.status === 401 || response.status === 403) {
          setToken(null);
          expired.forEach((fn) => {
            fn();
          });
          return null;
        }
        const result = await readResponse<{ accessToken?: string }>(response);
        if (session !== generation) return token;
        if (!result?.accessToken) throw new ApiError(502, "Không nhận được phiên đăng nhập.");
        token = result.accessToken;
        publishToken(token);
        return token;
      })
      .finally(() => {
        if (flight === pending) flight = null;
      });
    flight = pending;
    return pending;
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//"))
      throw new TypeError("Expected an API-relative path");
    const { body, method = "GET", signal, idempotencyKey, auth = true } = options;
    const initialToken = auth ? token : null;
    const session = generation;
    const send = (access: string | null) => {
      const headers = new Headers({ Accept: "application/json" });
      if (access) headers.set("Authorization", `Bearer ${access}`);
      if (body !== undefined) headers.set("Content-Type", "application/json");
      if (idempotencyKey) headers.set("Idempotency-Key", idempotencyKey);
      return transport(`${prefix}${path}`, {
        method,
        credentials: "include",
        signal,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    };
    let response = await send(initialToken);
    if (auth && initialToken && response.status === 401 && session === generation) {
      const access = token !== initialToken ? token : await refresh();
      if (!access) return readResponse<T>(response);
      if (session === generation) response = await send(access);
    }
    if (auth && initialToken && session !== generation)
      throw new DOMException("Phiên đăng nhập đã đổi.", "AbortError");
    const value = await readResponse<T>(response);
    if (auth && initialToken && session !== generation)
      throw new DOMException("Phiên đăng nhập đã đổi.", "AbortError");
    return value;
  }

  return {
    setToken,
    getToken: () => token,
    refresh,
    request,
    onExpired(callback: () => void) {
      expired.add(callback);
      return () => {
        expired.delete(callback);
      };
    },
    dispose() {
      unsubscribeAuthSync?.();
    },
  };
}

export const apiOrigin = (import.meta.env?.VITE_API_ORIGIN ?? "").replace(/\/$/, "");
export const sessionClient = createClient(apiOrigin);
export const api = sessionClient.request;
