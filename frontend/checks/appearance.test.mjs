import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const origin = process.env.MXH_TEST_URL || "http://localhost:3000";
const shots = process.env.MXH_SHOTS;
if (shots) await mkdir(shots, { recursive: true });
const account = {
  id: "appearance-viewer",
  username: "nguoi_doc",
  displayName: "Người đọc",
  email: "reader@example.test",
  avatarUrl: null,
  isEmailVerified: true,
};
const sample = {
  id: "appearance-post",
  author: { id: "author", username: "tac_gia", displayName: "Nguyễn Thảo" },
  content:
    "Tiếng Việt: Trường học, những chuyến đi và câu chuyện thường ngày. Ắ ằ ẵ ặ Ế ề ễ ệ Ố ồ ỗ ộ Ớ ờ ỡ ợ Ứ ừ ữ ự Ỳ ỷ ỹ ỵ Đ đ.",
  createdAt: "2026-01-01T00:00:00Z",
  editedAt: null,
  visibility: "PUBLIC",
  media: [],
  parentId: null,
  rootId: null,
  repostOfId: null,
  quotedPostId: null,
  isDeleted: false,
  counters: { likeCount: 0, bookmarkCount: 0, repostCount: 0, replyCount: 0, quoteCount: 0 },
  interactions: { isLiked: false, isBookmarked: false, isReposted: false },
};
const toggles = {
  like: ["isLiked", "likeCount"],
  bookmark: ["isBookmarked", "bookmarkCount"],
  repost: ["isReposted", "repostCount"],
};
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  colorScheme: "light",
  viewport: { width: 1440, height: 900 },
});
const failures = [];
context.on("page", (page) => page.on("pageerror", (error) => failures.push(error.message)));
await context.route("**/socket.io/**", (route) => route.fulfill({ status: 503 }));
await context.routeWebSocket("**/socket.io/**", (socket) => socket.close());
await context.route("**/api/v1/**", (route) => {
  const path = new URL(route.request().url()).pathname.split("/api/v1")[1];
  if (path === "/auth/refresh") return route.fulfill({ json: { accessToken: "appearance-token" } });
  if (path === "/auth/me") return route.fulfill({ json: account });
  if (path.endsWith("unread-count")) return route.fulfill({ json: { count: 0 } });
  for (const [action, [flag, counter]] of Object.entries(toggles)) {
    if (path !== `/posts/${sample.id}/${action}`) continue;
    const active = route.request().method() === "POST";
    sample.interactions[flag] = active;
    sample.counters[counter] = Number(active);
    return route.fulfill({
      json: { liked: active, bookmarked: active, reposted: active, [counter]: Number(active) },
    });
  }
  if (path.startsWith("/posts"))
    return route.fulfill({ json: { items: [sample], nextCursor: null } });
  return route.fulfill({ json: { items: [], nextCursor: null } });
});
const page = await context.newPage();
const theme = () => page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
const button = (name) => page.getByRole("button", { name, exact: true });
const card = () => page.getByRole("article", { name: "Bài viết của Nguyễn Thảo" });
async function capture(name) {
  if (shots) {
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true, animations: "disabled" });
  }
}
async function assertContrast() {
  const results = await page.evaluate(() => {
    function rgb(value) {
      const probe = document.createElement("span");
      probe.style.color = value;
      document.body.append(probe);
      const numbers = getComputedStyle(probe)
        .color.match(/[\d.]+/g)
        .slice(0, 3)
        .map(Number);
      probe.remove();
      return numbers
        .map((v) => {
          const c = v / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0);
    }
    const style = getComputedStyle(document.documentElement);
    const value = (token) => style.getPropertyValue(token);
    const pairs = [
      ["--color-ink", "--color-paper"],
      ["--color-muted", "--color-card"],
      ["--color-muted", "--color-paper-2"],
      ["--color-accent-ink", "--color-accent"],
      ["--color-error", "--color-danger-soft"],
    ];
    return pairs.map(([foreground, background]) => {
      const a = rgb(value(foreground));
      const b = rgb(value(background));
      return {
        pair: `${foreground}/${background}`,
        ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05),
      };
    });
  });
  for (const result of results)
    assert.ok(result.ratio >= 4.5, `${result.pair}: ${result.ratio.toFixed(2)} contrast`);
}
try {
  await page.goto(origin);
  await card().waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await button("Chuyển sang giao diện tối").count(), 1);
  await assertContrast();

  // Verify actual rendered glyphs: Vietnamese must come from the bundled font, not fallback.
  const cdp = await context.newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const document = await cdp.send("DOM.getDocument");
  const node = await cdp.send("DOM.querySelector", {
    nodeId: document.root.nodeId,
    selector: ".social-post-copy",
  });
  const { fonts } = await cdp.send("CSS.getPlatformFontsForNode", { nodeId: node.nodeId });
  assert.ok(fonts.some((font) => font.familyName === "Noto Sans" && font.isCustomFont));
  assert.ok(
    fonts.every((font) => font.familyName === "Noto Sans"),
    JSON.stringify(fonts),
  );
  assert.equal(
    await page.locator('.rail [aria-current="page"] [data-variant="selected"]').count(),
    1,
  );

  for (const [off, on, name] of [
    ["Thích", "Bỏ thích", "heart"],
    ["Lưu bài", "Bỏ lưu bài", "bookmark"],
    ["Đăng lại", "Bỏ đăng lại", "repost"],
  ]) {
    const control = card().getByRole("button", { name: off, exact: true });
    const icon = control.locator(`[data-icon="${name}"]`);
    const outline = await icon.innerHTML();
    assert.equal(await icon.getAttribute("data-variant"), "outline");
    await control.click();
    const pressed = card().getByRole("button", { name: `${on}: 1`, exact: true });
    await pressed.waitFor();
    assert.equal(await pressed.getAttribute("aria-pressed"), "true");
    assert.equal(await pressed.locator("svg").getAttribute("data-variant"), "selected");
    assert.notEqual(await pressed.locator("svg").innerHTML(), outline);
    await pressed.click();
    await control.waitFor();
    assert.equal(await control.getAttribute("aria-pressed"), "false");
    assert.equal(await icon.innerHTML(), outline);
  }
  await capture("desktop-light");
  const lightLayout = await page
    .locator(".workspace")
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns);
  await button("Chuyển sang giao diện tối").click();
  assert.equal(await theme(), "dark");
  assert.equal(await page.evaluate(() => localStorage.getItem("mxh:theme")), "dark");
  await assertContrast();
  assert.equal(
    await page.locator(".workspace").evaluate((el) => getComputedStyle(el).gridTemplateColumns),
    lightLayout,
  );
  await capture("desktop-dark");
  await page.reload();
  await card().waitFor();
  assert.equal(await theme(), "dark");

  const otherTab = await context.newPage();
  await otherTab.goto(origin);
  await otherTab.getByRole("button", { name: "Chuyển sang giao diện sáng", exact: true }).waitFor();
  await button("Chuyển sang giao diện sáng").click();
  await otherTab.getByRole("button", { name: "Chuyển sang giao diện tối", exact: true }).waitFor();
  await otherTab.close();

  for (const width of [1920, 960, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await assertContrast();
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
      `Overflow at ${width}px`,
    );
    assert.equal(await button("Chuyển sang giao diện tối").isVisible(), true);
    if (width === 390) await capture("phone-light");
  }
  await button("Chuyển sang giao diện tối").click();
  await page.setViewportSize({ width: 390, height: 844 });
  await assertContrast();
  await capture("phone-dark");
  await page.emulateMedia({ reducedMotion: "reduce" });
  assert.ok(
    await page
      .locator(".social-post-action")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration) <= 0.001),
  );
  await button("Chuyển sang giao diện sáng").focus();
  // Enter keyboard navigation before checking :focus-visible after pointer clicks.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await button("Chuyển sang giao diện sáng").evaluate(
      (el) => document.activeElement === el && getComputedStyle(el).outlineStyle === "solid",
    ),
    true,
  );

  // Page headings use the same hierarchy across directory and messaging screens.
  for (const path of ["/people", "/messages"]) {
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}${path}`);
      const heading = page.getByRole("heading", { level: 1 });
      await heading.waitFor();
      assert.equal(
        await heading.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
        width > 520 ? 24 : 22,
      );
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        true,
      );
      await capture(`${path.slice(1)}-${width}-dark`);
    }
  }

  // With no explicit choice, appearance follows system changes without reloading.
  const systemContext = await browser.newContext({ colorScheme: "dark" });
  await systemContext.route("**/api/v1/**", (route) => route.fulfill({ status: 401, json: {} }));
  const systemPage = await systemContext.newPage();
  await systemPage.goto(`${origin}/login`);
  await systemPage
    .getByRole("button", { name: "Chuyển sang giao diện sáng", exact: true })
    .waitFor();
  await systemPage.emulateMedia({ colorScheme: "light" });
  await systemPage
    .getByRole("button", { name: "Chuyển sang giao diện tối", exact: true })
    .waitFor();
  await systemPage.setViewportSize({ width: 320, height: 740 });
  assert.equal(
    await systemPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    true,
  );
  await systemContext.close();
  assert.deepEqual(failures, []);
  console.log(
    "Appearance: Vietnamese font glyphs, paired icon toggles, light/dark contrast, persistence, cross-tab/system updates, keyboard focus and responsive layout passed",
  );
} finally {
  await browser.close();
}
