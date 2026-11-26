import assert from "node:assert/strict";
import { test } from "node:test";
import type { AuthSyncMessage } from "../src/api.ts";

const loadApi = () => import("../src/api.ts");
const loadRoutes = () => import("../src/routes.ts");

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
  const client = createClient(
    "",
    async () =>
      new Promise<Response>((resolve) => {
        release = resolve;
      }),
  );
  const pending = client.refresh();
  await Promise.resolve();
  client.setToken("new-session");
  release(Response.json({ accessToken: "old-session" }));
  await pending;
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
