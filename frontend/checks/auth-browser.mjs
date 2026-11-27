import assert from "node:assert/strict";
import { createServer } from "node:http";
import { Server } from "socket.io";

const jwt = (sub, sessionId = sub) =>
  `e30.${Buffer.from(JSON.stringify({ sub, sessionId, exp: Math.floor(Date.now() / 1000) + 600 })).toString("base64url")}.fixture`;

// Real BroadcastChannel, React shell and Socket.IO; only REST is a fixture.
export async function checkAuth(browser, url) {
  const http = createServer();
  const io = new Server(http);
  await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
  const socketOrigin = `http://127.0.0.1:${http.address().port}`;
  const connected = new Map();
  io.on("connection", (socket) => {
    connected.set(socket.id, socket.handshake.auth.token);
    socket.on("disconnect", () => connected.delete(socket.id));
  });
  const context = await browser.newContext();
  const tokens = { alice: jwt("alice"), bob: jwt("bob") };
  const accounts = Object.fromEntries(
    ["alice", "bob"].map((name) => [
      name,
      {
        id: name,
        username: name,
        displayName: name,
        email: `${name}@example.test`,
        bio: null,
        avatarUrl: null,
        bannerUrl: null,
        isEmailVerified: true,
        createdAt: "2026-01-01T00:00:00Z",
      },
    ]),
  );
  let current = null;
  const writes = [];
  await context.route("**/socket.io/**", async (route) => {
    const target = new URL(route.request().url());
    await route.fulfill({
      response: await route.fetch({ url: socketOrigin + target.pathname + target.search }),
    });
  });
  await context.routeWebSocket("**/socket.io/**", (socket) => {
    const target = new URL(socket.url());
    socket.connectToServer(socketOrigin.replace("http:", "ws:") + target.pathname + target.search);
  });
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split("/api/v1")[1];
    if (path === "/auth/login") {
      current = request.postDataJSON().email.split("@")[0];
      return route.fulfill({ json: { user: accounts[current], accessToken: tokens[current] } });
    }
    if (path === "/auth/logout") {
      current = null;
      return route.fulfill({ json: { message: "ok" } });
    }
    if (path === "/auth/refresh")
      return current
        ? route.fulfill({ json: { accessToken: tokens[current] } })
        : route.fulfill({ status: 401, json: { message: "No session" } });
    if (path === "/auth/me") {
      const user = Object.keys(accounts).find(
        (name) => request.headers().authorization === `Bearer ${tokens[name]}`,
      );
      return route.fulfill({ status: user ? 200 : 401, json: user ? accounts[user] : {} });
    }
    if (request.method() !== "GET")
      writes.push({
        path,
        authorization: request.headers().authorization,
        body: request.postDataJSON(),
      });
    if (path.includes("unread-count")) return route.fulfill({ json: { count: 0 } });
    return route.fulfill({ json: { items: [], nextCursor: null } });
  });
  const first = await context.newPage();
  const second = await context.newPage();
  // Keep the second tab on its login form while Alice uses the first tab.
  await second.route("**/api/v1/auth/me", (route) => route.fulfill({ status: 401, json: {} }));
  await second.route("**/api/v1/auth/refresh", (route) => route.fulfill({ status: 401, json: {} }));
  first.setDefaultTimeout(7000);
  second.setDefaultTimeout(7000);
  const login = async (page, name) => {
    await page.getByLabel("Email", { exact: true }).fill(`${name}@example.test`);
    await page.getByLabel("Mật khẩu", { exact: true }).fill("password");
    await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
    await page.getByRole("navigation", { name: "Điều hướng chính" }).waitFor();
  };
  const waitFor = async (predicate) => {
    const deadline = Date.now() + 7000;
    while (!predicate()) {
      assert.ok(Date.now() < deadline, "socket lifecycle timed out");
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
  };
  try {
    await checkRecovery(browser, url, true, socketOrigin, () => io.disconnectSockets(true));
    await checkRecovery(browser, url, false, socketOrigin, () => io.disconnectSockets(true));
    await Promise.all([first.goto(`${url}/login`), second.goto(`${url}/login`)]);
    await login(first, "alice");
    await waitFor(() => [...connected.values()].includes(tokens.alice));
    await first.locator('a[href="/compose"]').first().click();
    await first.locator("textarea").first().fill("Alice private draft");
    await second.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor();
    await login(second, "bob");
    await waitFor(() => ![...connected.values()].includes(tokens.alice));
    await first.waitForFunction(
      () =>
        !document.body.textContent.includes("Alice private draft") &&
        !document.querySelector("textarea")?.value.includes("Alice private draft"),
    );
    assert.equal(
      writes.some((write) => JSON.stringify(write.body).includes("Alice private draft")),
      false,
    );
    await second.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await first.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor();
    await waitFor(() => connected.size === 0);
    assert.equal(
      await first.evaluate(
        () => localStorage.getItem("accessToken") ?? sessionStorage.getItem("accessToken"),
      ),
      null,
    );
    console.log("Browser auth: peer identity clears draft/shell/socket; logout clears both tabs");
  } finally {
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await context.close();
    await new Promise((resolve) => io.close(resolve));
    http.close();
  }
}

async function checkRecovery(browser, url, coordinated, socketOrigin, cleanupSockets) {
  const context = await browser.newContext();
  if (!coordinated)
    await context.addInitScript(() => {
      Object.defineProperty(window, "BroadcastChannel", { value: undefined });
      Object.defineProperty(navigator, "locks", { value: undefined });
    });
  const account = {
    id: "recovery",
    username: "recovery",
    displayName: "Recovery",
    email: "recovery@example.test",
    bio: null,
    avatarUrl: null,
    bannerUrl: null,
    isEmailVerified: true,
    createdAt: "2026-01-01T00:00:00Z",
  };
  let refreshes = 0;
  let cookie = "initial";
  let valid = jwt("recovery", "0");
  const authorizations = [];
  const trace = [];
  await context.addCookies([{ name: "refresh", value: cookie, url }]);
  await context.route("**/socket.io/**", async (route) => {
    const target = new URL(route.request().url());
    await route.fulfill({
      response: await route.fetch({ url: socketOrigin + target.pathname + target.search }),
    });
  });
  await context.routeWebSocket("**/socket.io/**", (socket) => {
    const target = new URL(socket.url());
    socket.connectToServer(socketOrigin.replace("http:", "ws:") + target.pathname + target.search);
  });
  await context.route("**/api/v1/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split("/api/v1")[1];
    if (path === "/auth/refresh") {
      refreshes++;
      const supplied = (await request.allHeaders()).cookie;
      trace.push({
        event: "refresh",
        attempt: refreshes,
        cookieMatches: supplied?.split("; ").includes(`refresh=${cookie}`),
      });
      await new Promise((resolve) => setTimeout(resolve, 30));
      if (!supplied?.split("; ").includes(`refresh=${cookie}`))
        return route.fulfill({ status: 401, json: {} });
      cookie = `rotation-${refreshes}`;
      valid = jwt("recovery", cookie);
      return route.fulfill({
        headers: { "Set-Cookie": `refresh=${cookie}; Path=/; HttpOnly; SameSite=Lax` },
        json: { accessToken: valid },
      });
    }
    if (path === "/auth/me" || path === "/recovery-check") {
      authorizations.push(request.headers().authorization);
      trace.push({ path, authorized: request.headers().authorization === `Bearer ${valid}` });
      if (request.headers().authorization !== `Bearer ${valid}`)
        return route.fulfill({ status: 401, json: {} });
      return route.fulfill({ json: path === "/auth/me" ? account : { ok: true } });
    }
    if (path.includes("unread-count")) return route.fulfill({ json: { count: 0 } });
    return route.fulfill({ json: { items: [], nextCursor: null } });
  });
  const pages = await Promise.all([context.newPage(), context.newPage()]);
  try {
    await Promise.all(pages.map((page) => page.goto(url)));
    if (coordinated) {
      await Promise.all(
        pages.map((page) => page.getByRole("navigation", { name: "Điều hướng chính" }).waitFor()),
      );
      assert.equal(refreshes, 1, "cold tabs must rotate the shared cookie once");
      const rejected = valid;
      valid = "server-revoked-access-only";
      const results = await Promise.all(
        pages.map((page) =>
          page.evaluate(async () => {
            const resource = performance
              .getEntriesByType("resource")
              .find((entry) => new URL(entry.name).pathname === "/src/api.ts");
            const { sessionClient } = await import(resource.name);
            return sessionClient.request("/recovery-check");
          }),
        ),
      );
      assert.deepEqual(results, [{ ok: true }, { ok: true }]);
      assert.equal(refreshes, 2, "two 401s must cause only one additional rotation");
      assert.equal(
        authorizations.filter((value) => value === `Bearer ${rejected}`).length >= 2,
        true,
      );
      assert.ok(authorizations.includes(`Bearer ${valid}`));
    } else {
      await Promise.all(
        pages.map((page) =>
          page.waitForFunction(
            () =>
              document.querySelector('nav[aria-label="Điều hướng chính"]') ||
              [...document.querySelectorAll("h1")].some(
                (heading) => heading.textContent === "Đăng nhập",
              ),
          ),
        ),
      );
      assert.equal(refreshes, 2, "unsupported coordination must remain bounded");
      const loggedOut = await Promise.all(
        pages.map((page) => page.getByRole("heading", { name: "Đăng nhập", exact: true }).count()),
      );
      assert.equal(
        loggedOut.reduce((sum, count) => sum + count, 0),
        1,
      );
    }
    console.log(
      `Browser auth recovery: shared cookie rotation (${coordinated ? "BroadcastChannel + Web Locks" : "bounded sign-in fallback"}) passed`,
    );
  } catch (error) {
    throw new Error(`Recovery fixture trace ${JSON.stringify(trace)}`, { cause: error });
  } finally {
    await context.unrouteAll({ behavior: "ignoreErrors" });
    await context.close();
    cleanupSockets?.();
  }
}
