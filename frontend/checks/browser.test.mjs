import assert from "node:assert/strict";
import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const account = {
  id: "person1",
  username: "mai_anh",
  displayName: "Mai Anh",
  email: "mai@example.test",
  bio: null,
  avatarUrl: null,
  bannerUrl: null,
  isEmailVerified: true,
  createdAt: "2026-01-01T00:00:00Z",
};
let requests = 0;
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.route("**/socket.io/**", (route) => route.fulfill({ status: 503 }));
await page.routeWebSocket("**/socket.io/**", (socket) => socket.close());
let loginBody;
await page.route("**/api/v1/**", async (route) => {
  const path = new URL(route.request().url()).pathname.split("/api/v1")[1];
  if (path === "/auth/refresh")
    return route.fulfill({ status: 401, json: { message: "No session" } });
  if (path === "/auth/login") {
    requests++;
    loginBody = route.request().postDataJSON();
    return route.fulfill({
      json: { message: "Đăng nhập thành công", accessToken: "signed", user: account },
    });
  }
  if (path.includes("unread-count")) return route.fulfill({ json: { count: 0 } });
  if (path.startsWith("/posts")) return route.fulfill({ json: { items: [], nextCursor: null } });
  if (path.startsWith("/users")) return route.fulfill({ json: { items: [], nextCursor: null } });
  return route.fulfill({ status: 404, json: { message: "Not found" } });
});
try {
  await page.goto(process.env.MXH_TEST_URL || "http://localhost:3000");
  await page.getByRole("heading", { name: "Đăng nhập", exact: true }).waitFor({ timeout: 4000 });
  if (process.env.MXH_SHOTS) await page.screenshot({ path: `${process.env.MXH_SHOTS}/login.png` });
  await page.getByLabel("Email", { exact: true }).fill("mai@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Điều hướng chính" })
    .getByRole("link", { name: "Bảng tin", exact: true })
    .waitFor();
  assert.equal(requests, 1);
  assert.deepEqual(loginBody, { email: "mai@example.test", password: "password" });
  await page.getByText("Dòng thời gian còn trống", { exact: true }).waitFor();
  if (process.env.MXH_SHOTS) await page.screenshot({ path: `${process.env.MXH_SHOTS}/home.png` });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page
    .getByRole("navigation", { name: "Điều hướng trên điện thoại" })
    .getByRole("link", { name: "Thông báo" })
    .click();
  await page.waitForURL("**/notifications");
  await page.goBack();
  await page.waitForURL("**/");
  if (process.env.MXH_SHOTS) await page.screenshot({ path: `${process.env.MXH_SHOTS}/mobile.png` });
  console.log("Browser: login payload, session transition, mobile navigation and viewport passed");
} finally {
  await browser.close();
}
