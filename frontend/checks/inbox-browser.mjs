import assert from "node:assert/strict";

// REST/image fixtures isolate browser behavior; backend authorization is checked separately.
export async function checkInbox(page) {
  const peer = { id: "person2", username: "linh", displayName: "Linh", avatarUrl: null };
  const media = Array.from({ length: 5 }, (_, index) => ({
    id: `image-${index}`,
    publicId: `mxh/person2/messages/${index}`,
    url: `https://images.example.test/${index}.png`,
    width: 640,
    height: 480,
    format: "png",
    bytes: 100,
    order: index,
  }));
  const messages = Array.from({ length: 30 }, (_, index) => ({
    id: `message-${index}`,
    conversationId: "test-thread",
    senderId: "person2",
    clientMessageId: `client-${index}`,
    type: index === 28 || index === 29 ? "IMAGE" : "TEXT",
    body: index === 28 || index === 29 ? "" : `Tin nhắn ${index}`,
    media: index === 28 ? media.slice(0, 1) : index === 29 ? media : [],
    createdAt: "2026-11-26T00:00:00Z",
    deletedAt: null,
  }));
  const conversation = {
    id: "test-thread",
    participant: peer,
    lastMessage: messages.at(-1),
    unreadCount: 0,
    updatedAt: "2026-11-26T00:00:00Z",
  };
  let reads = 0;
  let uploads = 0;
  let failUpload = true;
  let committed = null;
  let expireNext = false;
  const attempts = [];
  let releaseImage;
  const delayedImage = new Promise((resolve) => {
    releaseImage = resolve;
  });
  await page.route("https://api.cloudinary.com/**", (route) => {
    uploads++;
    if (uploads === 2 && failUpload) {
      failUpload = false;
      return route.fulfill({ status: 500 });
    }
    return route.fulfill({
      json: {
        public_id: `mxh/person1/messages/upload-${uploads}`,
        version: 1,
        signature: "fixture-signature",
      },
    });
  });
  await page.route("https://images.example.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/0.png") await delayedImage;
    if (path === "/1.png") return route.fulfill({ status: 404 });
    return route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  });
  await page.route("**/api/v1/conversations**", (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === "GET") reads++;
    if (path.endsWith("unread-count")) return route.fulfill({ json: { count: 0 } });
    if (path.endsWith("/read")) return route.fulfill({ json: { success: true, unreadCount: 0 } });
    if (path.endsWith("/media/upload-signature"))
      return route.fulfill({
        json: {
          cloudName: "fixture",
          apiKey: "fixture",
          timestamp: 1,
          signature: "signed",
          folder: "mxh/person1/messages",
          resourceType: "image",
        },
      });
    if (path.endsWith("/messages") && request.method() === "POST") {
      if (expireNext)
        return route.fulfill({
          status: 400,
          json: { message: "Ảnh đã hết hạn, vui lòng chọn và tải lại ảnh" },
        });
      const body = request.postDataJSON();
      attempts.push(body);
      if (!committed) {
        committed = {
          ...messages[0],
          id: "sent-image",
          senderId: "person1",
          ...body,
          type: "IMAGE",
          media: body.media.map((item, order) => ({ ...media[order], ...item })),
        };
        messages.push(committed);
        return route.abort("failed"); // Simulate a lost response after committing once.
      }
      assert.equal(body.clientMessageId, committed.clientMessageId);
      return route.fulfill({ json: committed });
    }
    if (path.endsWith("/messages"))
      return route.fulfill({ json: { data: messages, hasMore: false, nextCursor: null } });
    if (path.endsWith("test-thread")) return route.fulfill({ json: conversation });
    return route.fulfill({ json: { data: [conversation], hasMore: false, nextCursor: null } });
  });
  // Navigate within the SPA so its authenticated session remains in memory.
  await page
    .getByRole("navigation", { name: "Điều hướng trên điện thoại" })
    .getByRole("link", { name: "Tin nhắn", exact: true })
    .click();
  await page.getByRole("link", { name: /Linh/ }).click();
  await page.getByPlaceholder("Viết tin nhắn…").waitFor();
  await page.locator(".mx-message-images").last().waitFor();
  assert.equal(await page.locator(".mx-message-images").nth(0).getByRole("button").count(), 1);
  assert.equal(await page.locator(".mx-message-images").nth(1).getByRole("button").count(), 5);
  assert.equal(await page.getByText("Đã gửi 5 ảnh", { exact: true }).textContent(), "Đã gửi 5 ảnh");
  await page.locator(".mx-message-images").last().getByAltText("Không tải được ảnh").waitFor();
  const log = page.locator(".mx-inbox-log");
  await log.evaluate((element) => {
    element.scrollTop = 100;
  });
  await page.getByRole("button", { name: "Đến tin nhắn mới nhất", exact: true }).waitFor();
  const historyPosition = await log.evaluate((element) => element.scrollTop);
  const loaded = page.waitForResponse("https://images.example.test/0.png");
  releaseImage();
  await loaded;
  await page.waitForFunction(() =>
    Array.from(document.querySelectorAll('.mx-message-images img[src$="/0.png"]')).every(
      (image) => image.complete && image.naturalWidth > 0,
    ),
  );
  assert.equal(
    await log.evaluate((element) => element.scrollTop),
    historyPosition,
    "late images must not pull the reader to the bottom",
  );
  await page.getByRole("button", { name: "Đến tin nhắn mới nhất", exact: true }).click();
  const opener = page
    .locator(".mx-message-images")
    .last()
    .getByRole("button", { name: "Xem ảnh 2", exact: true });
  await opener.click();
  const viewer = page.getByRole("dialog", { name: "Xem ảnh", exact: true });
  await viewer.waitFor();
  await viewer.getByText("2 / 5", { exact: true }).waitFor();
  await page.keyboard.press("ArrowRight");
  await viewer.getByText("3 / 5", { exact: true }).waitFor();
  await page.keyboard.press("Escape");
  await viewer.waitFor({ state: "hidden" });
  assert.equal(await opener.evaluate((element) => element === document.activeElement), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  await page.getByLabel("Thêm ảnh", { exact: true }).setInputFiles([
    { name: "one.png", mimeType: "image/png", buffer: Buffer.from("one") },
    { name: "two.png", mimeType: "image/png", buffer: Buffer.from("two") },
  ]);
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  await page.getByRole("button", { name: "Thử lại ảnh 2", exact: true }).waitFor();
  assert.equal(attempts.length, 0, "must not send a partial image group");
  await page.getByRole("button", { name: "Thử lại ảnh 2", exact: true }).click();
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Không thể gửi tin nhắn" }).waitFor();
  assert.equal(attempts.length, 1);
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  await page.locator(".mx-message-attachments").waitFor({ state: "hidden" });
  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts[0], attempts[1]);
  assert.equal(uploads, 3, "successful images must not upload again on retry");

  expireNext = true;
  await page
    .getByLabel("Thêm ảnh", { exact: true })
    .setInputFiles({ name: "expired.png", mimeType: "image/png", buffer: Buffer.from("expired") });
  await page.getByRole("button", { name: "Gửi", exact: true }).click();
  await page
    .getByRole("alert")
    .filter({ hasText: "Ảnh đã hết hạn, vui lòng chọn và tải lại ảnh" })
    .waitFor();
  await page.getByRole("button", { name: "Bỏ ảnh 1", exact: true }).click();
  await page.clock.install();
  const indicator = page.getByText("Linh đang nhập…", { exact: true });
  const relay = (data) =>
    page.evaluate(
      (data) =>
        window.dispatchEvent(
          new CustomEvent("mxh:realtime", { detail: { event: "conversation:typing", data } }),
        ),
      data,
    );
  const payload = {
    conversationId: "test-thread",
    userId: "person2",
    streamId: "tab-1",
    isTyping: true,
  };
  const before = reads;
  const height = await page.locator(".mx-inbox-log").evaluate((element) => element.clientHeight);
  await relay(payload);
  await indicator.waitFor({ timeout: 1500 });
  assert.equal(
    await page.locator(".mx-inbox-log").evaluate((element) => element.clientHeight),
    height,
  );
  await relay({ ...payload, streamId: "tab-2" });
  await relay({ ...payload, isTyping: false });
  assert.equal(await indicator.isVisible(), true);
  await page.clock.fastForward(3999);
  assert.equal(await indicator.isVisible(), true);
  await page.clock.fastForward(1);
  await indicator.waitFor({ state: "hidden" });
  await relay(payload);
  await indicator.waitFor();
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("mxh:realtime", { detail: { event: "disconnect", data: null } }),
    ),
  );
  await indicator.waitFor({ state: "hidden" });
  assert.equal(reads, before, "typing must not reload conversation data");
  await page.setViewportSize({ width: 1440, height: 900 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  console.log(
    "Inbox browser: image grids/viewer, partial upload failure, retry after lost commit response, cached uploads, mobile layout, typing expiry/multiple streams/disconnect and no reload passed.",
  );
}
