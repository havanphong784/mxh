import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const server = spawn(
  process.execPath,
  ["../node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--port", "4317", "--strictPort"],
  { stdio: "ignore" },
);
const base = "http://127.0.0.1:4317";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6C1AAAAAASUVORK5CYII=",
  "base64",
);
const peer = { id: "bob", username: "bob", displayName: "Bob", avatarUrl: null };
const account = {
  ...peer,
  id: "alice",
  username: "alice",
  displayName: "Alice",
  email: "alice@example.test",
  isEmailVerified: true,
};
let messages = [];
let uploads = 0;
let sends = 0;
const conversation = () => ({
  id: "thread",
  type: "DIRECT",
  participant: peer,
  lastMessage: messages.at(-1) ?? null,
  unreadCount: 0,
  updatedAt: "2026-11-26T00:00:00Z",
});
let browser;
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(base)).ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/socket.io/**", (route) => route.fulfill({ status: 503 }));
  await page.routeWebSocket("**/socket.io/**", (socket) => socket.close());
  await page.route("https://res.cloudinary.com/**", (route) =>
    route.fulfill({ contentType: "image/png", body: png }),
  );
  await page.route("https://api.cloudinary.com/**", (route) => {
    uploads++;
    return route.fulfill({
      json: { public_id: `mxh/alice/messages/${uploads}`, version: 1, signature: "signed" },
    });
  });
  await page.route("**/api/v1/**", (route) => {
    const path = new URL(route.request().url()).pathname.split("/api/v1")[1];
    if (path === "/auth/refresh") return route.fulfill({ json: { accessToken: "test-token" } });
    if (path === "/auth/me") return route.fulfill({ json: account });
    if (path.includes("unread-count")) return route.fulfill({ json: { count: 0 } });
    if (path.endsWith("/media/upload-signature"))
      return route.fulfill({
        json: {
          cloudName: "fixture",
          apiKey: "public",
          signature: "signed",
          timestamp: 123,
          folder: "mxh/alice/messages",
          resourceType: "image",
        },
      });
    if (path === "/conversations/thread/messages") {
      if (route.request().method() === "POST") {
        sends++;
        const input = route.request().postDataJSON();
        const media = input.media.map((item, order) => ({
          ...item,
          id: `media-${order}`,
          url: `https://res.cloudinary.com/fixture/${item.publicId}.png`,
          width: 300,
          height: 200,
          format: "png",
          bytes: png.length,
          order,
        }));
        const message = {
          ...input,
          id: `message-${sends}`,
          conversationId: "thread",
          senderId: "alice",
          type: "IMAGE",
          media,
          createdAt: "2026-11-26T00:00:00Z",
          editedAt: null,
          deletedAt: null,
        };
        messages.push(message);
        return route.fulfill({ json: message });
      }
      return route.fulfill({ json: { data: messages, nextCursor: null, hasMore: false } });
    }
    if (path === "/conversations/thread") return route.fulfill({ json: conversation() });
    if (path === "/conversations/thread/read")
      return route.fulfill({ json: { success: true, unreadCount: 0 } });
    if (path === "/conversations")
      return route.fulfill({ json: { data: [conversation()], nextCursor: null, hasMore: false } });
    return route.fulfill({ json: { items: [], nextCursor: null } });
  });
  await page.goto(`${base}/messages/thread`);
  await page.getByPlaceholder("Viết tin nhắn…").waitFor();
  await page
    .getByLabel("Thêm ảnh", { exact: true })
    .setInputFiles(
      [1, 2, 3, 4, 5].map((n) => ({ name: `image-${n}.png`, mimeType: "image/png", buffer: png })),
    );
  assert.equal(await page.getByRole("button", { name: /Bỏ ảnh/ }).count(), 5);
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  await page.getByRole("button", { name: "Xem ảnh 1", exact: true }).waitFor();
  assert.equal(uploads, 5);
  assert.equal(sends, 1);
  await page.getByRole("button", { name: "Xem ảnh 1", exact: true }).click();
  await page.getByRole("dialog", { name: "Xem ảnh" }).waitFor();
  await page.keyboard.press("ArrowRight");
  await page.getByText("2 / 5", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(
    await page
      .getByRole("button", { name: "Xem ảnh 1", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log(
    "Inbox browser: five-image upload, image-only send, viewer keyboard/focus, mobile passed (fixture APIs).",
  );
} finally {
  await browser?.close();
  server.kill();
}
