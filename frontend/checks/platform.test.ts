import assert from "node:assert/strict";
import { test } from "node:test";
import type { AuthSyncMessage } from "../src/api.ts";
import { createArrivalBarrier } from "./async-barrier.mjs";

test("arrival barrier holds the first request until its peer arrives", async () => {
  const arrive = createArrivalBarrier(2);
  let released = false;
  const first = arrive().then(() => {
    released = true;
  });
  await Promise.resolve();
  assert.equal(released, false, "the first request cannot rotate a cookie before its peer arrives");

  await Promise.all([first, arrive()]);
  assert.equal(released, true);
});

test("arrival barrier rejects a missing peer within its configured timeout", {
  timeout: 1000,
}, async () => {
  const arrive = createArrivalBarrier(2, 20);
  await assert.rejects(arrive(), /arrival barrier.*timed out/i);
});

const loadApi = () => import("../src/api.ts");
const loadRoutes = () => import("../src/routes.ts");

test("peer login invalidates the existing identity before the next write", async () => {
  const { createClient } = await loadApi();
  const listeners = new Set<(message: AuthSyncMessage) => void>();
  const bus = {
    publish(message: AuthSyncMessage) {
      for (const listener of listeners) listener(message);
    },
    subscribe(listener: (message: AuthSyncMessage) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const sent: (string | null)[] = [];
  const first = createClient(
    "",
    async (_url, init) => {
      sent.push(new Headers(init?.headers).get("Authorization"));
      return Response.json({ ok: true });
    },
    bus,
  );
  const second = createClient("", async () => Response.json({ ok: true }), bus);
  first.setToken("token-A");
  let cleared = 0;
  first.onExpired(() => cleared++);

  second.setToken("token-B");
  await first.request("/draft", { method: "POST", body: { text: "draft" } });

  assert.equal(cleared, 1);
  assert.deepEqual(sent, [null]);
  assert.equal(first.getToken(), null);
});

test("peer logout clears the other tab once without echoing", async () => {
  const { createClient } = await loadApi();
  const listeners = new Set<(message: AuthSyncMessage) => void>();
  const bus = {
    publish(message: AuthSyncMessage) {
      for (const listener of listeners) listener(message);
    },
    subscribe(listener: (message: AuthSyncMessage) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const first = createClient("", async () => Response.json({ ok: true }), bus);
  const second = createClient("", async () => Response.json({ ok: true }), bus);
  first.setToken("shared-token");
  assert.equal(await second.refresh(), "shared-token");
  let cleared = 0;
  first.onExpired(() => cleared++);

  second.setToken(null);

  assert.equal(cleared, 1);
  assert.equal(first.getToken(), null);
  assert.equal(second.getToken(), null);
});

test("a new tab reuses an active tab access token before rotating the shared cookie", async () => {
  const { createClient } = await loadApi();
  type Message = AuthSyncMessage;

  const listeners = new Set<(message: Message) => void>();
  const bus = {
    publish(message: Message) {
      for (const listener of listeners) listener(message);
    },
    subscribe(listener: (message: Message) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  let refreshes = 0;
  const leader = createClient(
    "",
    async () => {
      refreshes++;
      return Response.json({ accessToken: "unexpected" });
    },
    bus,
  );
  const follower = createClient(
    "",
    async () => {
      refreshes++;
      return Response.json({ accessToken: "unexpected" });
    },
    bus,
  );
  leader.setToken("active-tab-token");
  assert.equal(await follower.refresh(), "active-tab-token");
  assert.equal(refreshes, 0);
});

test("concurrent expired requests reuse one refresh and retry with its token", async () => {
  const { createClient } = await loadApi();
  let refreshes = 0;
  const client = createClient("http://api.test", async (url, init) => {
    if (String(url).endsWith("/auth/refresh")) {
      refreshes++;
      assert.equal(init?.credentials, "include");
      await new Promise((resolve) => setTimeout(resolve, 12));
      return Response.json({ accessToken: "fresh" });
    }
    return new Headers(init?.headers).get("Authorization") === "Bearer fresh"
      ? Response.json({ id: String(url).split("/").pop() })
      : new Response(null, { status: 401 });
  });
  client.setToken("expired");
  assert.deepEqual(await Promise.all([client.request("/items/1"), client.request("/items/2")]), [
    { id: "1" },
    { id: "2" },
  ]);
  assert.equal(refreshes, 1);
});

test("a rejected refresh drops the token without replaying the private request", async () => {
  const { createClient } = await loadApi();
  let requests = 0;
  const client = createClient("", async (url) => {
    if (!String(url).endsWith("/auth/refresh")) requests++;
    return new Response(null, { status: 401 });
  });
  client.setToken("expired");
  await assert.rejects(client.request("/private"), { status: 401 });
  assert.equal(requests, 1);
  assert.equal(client.getToken(), null);
});

test("a late refresh cannot overwrite a newly established session", async () => {
  const { createClient } = await loadApi();
  let release: (response: Response) => void = () => {};
  let entered!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const client = createClient(
    "",
    async () =>
      new Promise<Response>((resolve) => {
        release = resolve;
        entered();
      }),
  );
  const pending = client.refresh();
  await started;
  client.setToken("new-session");
  release(Response.json({ accessToken: "old-session" }));
  await assert.rejects(pending, { name: "AbortError" });
  assert.equal(client.getToken(), "new-session");
});

test("a network failure does not expire an established session", async () => {
  const { createClient } = await loadApi();
  const client = createClient("", async (url) => {
    if (String(url).endsWith("/auth/refresh")) throw new Error("offline");
    return new Response(null, { status: 401 });
  });
  client.setToken("old");
  await assert.rejects(client.request("/private"), /offline/);
  assert.equal(client.getToken(), "old");
});

test("refresh retries preserve write idempotency and errors expose API messages", async () => {
  const { createClient } = await loadApi();
  const keys: (string | null)[] = [];
  const client = createClient("", async (url, init) => {
    if (String(url).endsWith("/auth/refresh")) return Response.json({ accessToken: "fresh" });
    keys.push(new Headers(init?.headers).get("Idempotency-Key"));
    return keys.length === 1
      ? new Response(null, { status: 401 })
      : Response.json({ message: ["Vui lòng thử lại"] }, { status: 400 });
  });
  client.setToken("old");
  await assert.rejects(
    client.request("/posts", {
      method: "POST",
      body: { content: "test" },
      idempotencyKey: "unique",
    }),
    { message: "Vui lòng thử lại", status: 400 },
  );
  assert.deepEqual(keys, ["unique", "unique"]);
});

function authBus() {
  const listeners = new Set<(message: AuthSyncMessage) => void>();
  return {
    publish(message: AuthSyncMessage) {
      for (const listener of listeners) queueMicrotask(() => listener(message));
    },
    subscribe(listener: (message: AuthSyncMessage) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const accessToken = (sub: string, version: string, expiresIn = 600) =>
  `e30.${btoa(JSON.stringify({ sub, sessionId: version, exp: Math.floor(Date.now() / 1000) + expiresIn }))}.signature`;

async function coordinated(run: () => Promise<void>) {
  const previous = Object.getOwnPropertyDescriptor(navigator, "locks");
  let queue = Promise.resolve<unknown>(undefined);
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request(_name: string, _options: unknown, callback: () => Promise<unknown>) {
        const pending = queue.then(callback);
        queue = pending.catch(() => {});
        return pending;
      },
    },
  });
  try {
    await run();
  } finally {
    if (previous) Object.defineProperty(navigator, "locks", previous);
    else Reflect.deleteProperty(navigator, "locks");
  }
}

test("two tabs recover rejected tokens with one coordinated cookie refresh", async () => {
  await coordinated(async () => {
    const { createClient } = await loadApi();
    const bus = authBus();
    const old = accessToken("alice", "old");
    const fresh = accessToken("alice", "rotated");
    let refreshes = 0;
    const transport: typeof fetch = async (url, init) => {
      if (String(url).endsWith("/auth/refresh")) {
        refreshes++;
        await new Promise((resolve) => setTimeout(resolve, 15));
        return Response.json({ accessToken: fresh });
      }
      return new Headers(init?.headers).get("Authorization") === `Bearer ${fresh}`
        ? Response.json({ ok: true })
        : new Response(null, { status: 401 });
    };
    const first = createClient("", transport, bus);
    first.setToken(old);
    await Promise.resolve();
    const second = createClient("", transport, bus);
    assert.equal(await second.refresh(), old);
    const results = await Promise.all([first.request("/private"), second.request("/private")]);
    assert.deepEqual(results, [{ ok: true }, { ok: true }]);
    assert.equal(refreshes, 1);
    first.dispose();
    second.dispose();
  });
});

test("cold tabs serialize bootstrap refresh and reuse the verified peer candidate", async () => {
  await coordinated(async () => {
    const { createClient } = await loadApi();
    const bus = authBus();
    let refreshes = 0;
    const transport: typeof fetch = async () => {
      refreshes++;
      await new Promise((resolve) => setTimeout(resolve, 15));
      return Response.json({ accessToken: accessToken("alice", "cold") });
    };
    const first = createClient("", transport, bus);
    const second = createClient("", transport, bus);
    const results = await Promise.all([first.refresh(), second.refresh()]);
    assert.ok(results.every(Boolean));
    assert.equal(refreshes, 1);
    first.dispose();
    second.dispose();
  });
});

test("expired or rejected peer replies cannot satisfy a refresh waiter", async () => {
  const { createClient } = await loadApi();
  const rejected = accessToken("alice", "rejected");
  const expired = accessToken("alice", "expired", -10);
  let listener: (message: AuthSyncMessage) => void = () => {};
  let refreshes = 0;
  const fresh = accessToken("alice", "fresh");
  let requests = 0;
  const client = createClient(
    "",
    async (url, init) => {
      if (String(url).endsWith("/auth/refresh")) {
        refreshes++;
        return Response.json({ accessToken: fresh });
      }
      requests++;
      return new Headers(init?.headers).get("Authorization") === `Bearer ${fresh}`
        ? Response.json({ ok: true })
        : new Response(null, { status: 401 });
    },
    {
      subscribe(next) {
        listener = next;
        return () => {};
      },
      publish(message) {
        if (message.type !== "request-token") return;
        listener({ type: "token", requestId: message.requestId, token: rejected });
        listener({ type: "token", requestId: message.requestId, token: expired });
      },
    },
  );
  client.setToken(rejected);
  assert.deepEqual(await client.request("/private"), { ok: true });
  assert.equal(requests, 2);
  assert.equal(client.getToken(), fresh);
  assert.equal(refreshes, 1);
  client.dispose();
});

test("aborting a request during refresh rejects with AbortError and never replays its write", async () => {
  const { createClient } = await loadApi();
  let entered!: () => void;
  let release!: (response: Response) => void;
  const refreshing = new Promise<void>((resolve) => {
    entered = resolve;
  });
  let sends = 0;
  const client = createClient("", async (url) => {
    if (String(url).endsWith("/auth/refresh")) {
      entered();
      return new Promise<Response>((resolve) => {
        release = resolve;
      });
    }
    sends++;
    return new Response(null, { status: 401 });
  });
  const controller = new AbortController();
  client.setToken("old");
  const pending = client.request("/posts", {
    method: "POST",
    body: { content: "cancelled" },
    signal: controller.signal,
  });
  const rejected = assert.rejects(pending, { name: "AbortError" });
  await refreshing;
  controller.abort();
  release(Response.json({ accessToken: "fresh" }));
  await rejected;
  assert.equal(sends, 1);
  assert.equal(
    client.getToken(),
    "fresh",
    "cancellation does not discard the shared refresh result",
  );
  client.dispose();
});

test("a second 401 clears the rejected replacement without a refresh loop", async () => {
  const { createClient } = await loadApi();
  let refreshes = 0;
  let sends = 0;
  const client = createClient("", async (url) => {
    if (String(url).endsWith("/auth/refresh")) {
      refreshes++;
      return Response.json({ accessToken: "replacement" });
    }
    sends++;
    return new Response(null, { status: 401 });
  });
  client.setToken("old");
  await assert.rejects(client.request("/private"), { status: 401 });
  assert.equal(refreshes, 1);
  assert.equal(sends, 2);
  assert.equal(client.getToken(), null);
});

test("identity change while waiting for the refresh lock aborts a queued write", async () => {
  const { createClient } = await loadApi();
  const previous = Object.getOwnPropertyDescriptor(navigator, "locks");
  let entered!: () => void;
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      async request(_name: string, _options: unknown, callback: () => Promise<unknown>) {
        entered();
        await gate;
        return callback();
      },
    },
  });
  let sends = 0;
  const client = createClient("", async (url) => {
    if (String(url).endsWith("/auth/refresh"))
      throw new Error("must not refresh a changed session");
    sends++;
    return new Response(null, { status: 401 });
  });
  try {
    client.setToken("alice");
    const pending = assert.rejects(
      client.request("/posts", { method: "POST", body: { content: "draft" } }),
      { name: "AbortError" },
    );
    await waiting;
    client.setToken("bob");
    release();
    await pending;
    assert.equal(sends, 1);
  } finally {
    if (previous) Object.defineProperty(navigator, "locks", previous);
    else Reflect.deleteProperty(navigator, "locks");
    client.dispose();
  }
});

test("a bare username remains a working public link, but private routes require sign in", async () => {
  const { resolveRoute, safeReturn } = await loadRoutes();
  assert.deepEqual(resolveRoute("/thu_linh?ref=abc"), {
    area: "people",
    path: "/profile/thu_linh?ref=abc",
    private: false,
  });
  assert.deepEqual(resolveRoute("/messages/123"), {
    area: "inbox",
    path: "/messages/123",
    private: true,
  });
  assert.equal(safeReturn("//untrusted.test"), "/");
  assert.equal(safeReturn("/\\untrusted.test"), "/");
  assert.equal(safeReturn("/bookmarks?q=mot"), "/bookmarks?q=mot");
});

test("an authenticated response from an expired session cannot republish private state", async () => {
  const { createClient } = await loadApi();
  let reply: (response: Response) => void = () => {};
  const client = createClient("", async (url) =>
    String(url).endsWith("/users/me")
      ? new Promise<Response>((resolve) => {
          reply = resolve;
        })
      : new Response(null, { status: 401 }),
  );
  client.setToken("old");
  const pending = client.request("/users/me", { method: "PATCH" });
  await assert.rejects(client.request("/private"), { status: 401 });
  reply(Response.json({ id: "stale" }));
  await assert.rejects(pending, { name: "AbortError" });
});

test("bookmarked liked and security URLs resolve to their private replacement pages", async () => {
  const { resolveRoute } = await loadRoutes();
  assert.deepEqual(resolveRoute("/liked?q=abc"), {
    area: "social",
    path: "/likes?q=abc",
    private: true,
  });
  assert.deepEqual(resolveRoute("/settings/security"), {
    area: "people",
    path: "/settings",
    private: true,
  });
});
