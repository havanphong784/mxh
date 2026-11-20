export interface RequestOptions {
  method?: string;
  body?: unknown;
  auth?: boolean;
  signal?: AbortSignal;
  idempotencyKey?: string;
}

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
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
    if (response.ok)
      throw new ApiError(502, "Máy chủ trả về dữ liệu không hợp lệ.");
  }
  if (!response.ok) {
    const raw = (payload as { message?: unknown } | undefined)?.message;
    const message = Array.isArray(raw)
      ? raw
          .filter((item): item is string => typeof item === "string")
          .join(" · ")
      : raw;
    throw new ApiError(
      response.status,
      typeof message === "string" && message
        ? message
        : `Không thể hoàn tất yêu cầu (${response.status}).`,
    );
  }
  return payload as T;
}

export function createClient(origin: string, transport: typeof fetch = fetch) {
  const prefix = `${origin.replace(/\/$/, "")}/api/v1`;
  let token: string | null = null;
  let generation = 0;
  let flight: Promise<string | null> | null = null;
  const expired = new Set<() => void>();
  const setToken = (next: string | null) => {
    generation++;
    token = next;
    flight = null;
  };

  function refresh(): Promise<string | null> {
    if (flight) return flight;
    const session = generation;
    const pending = Promise.resolve()
      .then(async () => {
        const response = await transport(`${prefix}/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (session !== generation) return token;
        if (response.status === 401 || response.status === 403) {
          setToken(null);
          expired.forEach((fn) => fn());
          return null;
        }
        const result = await readResponse<{ accessToken?: string }>(response);
        if (session !== generation) return token;
        if (!result?.accessToken)
          throw new ApiError(502, "Không nhận được phiên đăng nhập.");
        token = result.accessToken;
        return token;
      })
      .finally(() => {
        if (flight === pending) flight = null;
      });
    flight = pending;
    return pending;
  }

  async function request<T>(
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    if (!path.startsWith("/") || path.startsWith("//"))
      throw new TypeError("Expected an API-relative path");
    const {
      body,
      method = "GET",
      signal,
      idempotencyKey,
      auth = true,
    } = options;
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
    if (
      auth &&
      initialToken &&
      response.status === 401 &&
      session === generation
    ) {
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
  };
}

export const apiOrigin = (import.meta.env?.VITE_API_ORIGIN ?? "").replace(
  /\/$/,
  "",
);
export const sessionClient = createClient(apiOrigin);
export const api = sessionClient.request;
