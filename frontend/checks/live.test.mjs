import assert from "node:assert/strict";
import { chromium } from "playwright";

// Only run against a local app using a disposable database seeded by backend/scripts/seed.
const base = process.env.MXH_LIVE_TEST_URL;
if (!base || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(base).hostname))
  throw new Error("Set MXH_LIVE_TEST_URL to an explicitly disposable local deployment.");
const browser = await chromium.launch();
const errors = [];
const stamp = Date.now().toString(36);
async function login(username, width = 1440) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.getByLabel("Email", { exact: true }).fill(`${username}@example.test`);
  await page
    .getByLabel("Mật khẩu", { exact: true })
    .fill(process.env.MXH_TEST_PASSWORD || "Demo1234!");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page.getByPlaceholder("Bạn đang nghĩ gì?").waitFor();
  return page;
}
const fits = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
try {
  const a = await login("minhthu");
  await a.locator(".social-post-list li").first().waitFor();
  if (process.env.MXH_SHOTS)
    await a.screenshot({ path: `${process.env.MXH_SHOTS}/live-desktop.png` });
  const text = `Kiểm thử đăng bài ${stamp}`;
  await a.getByPlaceholder("Bạn đang nghĩ gì?").fill(text);
  await a.getByRole("button", { name: "Đăng bài", exact: true }).click();
  await a.locator(".social-post-copy").getByText(text, { exact: true }).waitFor();
  const posted = a.locator("article").filter({ hasText: text });
  const bookmark = posted.getByRole("button", { name: /Lưu bài/ });
  await bookmark.click();
  await posted.getByRole("button", { name: /Bỏ lưu/ }).waitFor();
  await a
    .getByRole("navigation", { name: "Điều hướng chính" })
    .getByRole("link", { name: "Đã lưu", exact: true })
    .click();
  await a.getByText(text, { exact: true }).waitFor();
  await a.goto(`${base}/profile/phuonglinh`);
  await a.getByRole("heading", { name: "Phương Linh", exact: true }).waitFor();
  await a.getByRole("link", { name: "Nhắn tin", exact: true }).click();
  await a.waitForURL("**/messages/*");
  const thread = a.url();
  const b = await login("phuonglinh", 390);
  await b.goto(thread);
  await b.getByPlaceholder("Viết tin nhắn…").waitFor();
  const message = `Tin nhắn trực tiếp ${stamp}`;
  await a.getByPlaceholder("Viết tin nhắn…").fill(message);
  await a.getByRole("button", { name: "Gửi", exact: true }).click();
  const delivered = b
    .getByRole("list", { name: "Tin nhắn", exact: true })
    .getByText(message, { exact: true });
  await delivered.waitFor({ timeout: 8000 });
  assert.equal(await delivered.count(), 1);
  assert.equal(await fits(b), true);
  if (process.env.MXH_SHOTS)
    await b.screenshot({ path: `${process.env.MXH_SHOTS}/live-inbox-mobile.png` });
  await b
    .getByRole("navigation", { name: "Điều hướng trên điện thoại" })
    .getByRole("link", { name: "Bảng tin", exact: true })
    .click();
  await b.getByPlaceholder("Bạn đang nghĩ gì?").waitFor();
  assert.equal(await fits(b), true);
  if (process.env.MXH_SHOTS)
    await b.screenshot({ path: `${process.env.MXH_SHOTS}/live-mobile.png` });
  assert.deepEqual(errors, []);
  console.log(
    "Two-account Chromium: real login, feed, post, bookmarks, profile, realtime delivery, and mobile navigation passed.",
  );
} finally {
  await browser.close();
}
