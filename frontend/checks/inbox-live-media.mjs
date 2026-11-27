import assert from "node:assert/strict";
import { v2 as cloudinary } from "cloudinary";

// Opt-in acceptance against the test cloud: no Cloudinary or metadata fixtures.
// Catches unsigned/broken uploads, missing image persistence, and duplicate sends
// after the server commits but its HTTP response is lost.
export async function checkLiveMessageMedia(sender, recipient, stamp) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  assert.equal(
    process.env.MXH_TEST_CLOUDINARY_CLOUD_NAME,
    cloudName,
    "Set MXH_TEST_CLOUDINARY_CLOUD_NAME to the explicitly approved test cloud",
  );
  assert.ok(
    cloudName && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET,
    "Test Cloudinary credentials are required",
  );
  cloudinary.config({
    cloud_name: cloudName,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6C1AAAAAASUVORK5CYII=",
    "base64",
  );
  const initialGroups = await recipient.locator(".mx-message-images").count();
  const assets = new Set();
  const observations = [];
  const started = Date.now();
  let uploads = 0;
  const observe = (response) => {
    const url = new URL(response.url());
    if (
      url.hostname !== "api.cloudinary.com" ||
      !url.pathname.endsWith("/image/upload") ||
      response.request().method() !== "POST"
    )
      return;
    observations.push(
      (async () => {
        if (!response.ok()) return;
        const asset = await response.json();
        // Cleanup only assets created by this browser run, never an inventory scan.
        assert.match(asset.public_id, /^mxh\/[^/]+\/messages\/.+/);
        assert.ok(Date.parse(asset.created_at) >= started - 1000);
        assets.add(asset.public_id);
        uploads++;
      })(),
    );
  };
  sender.on("response", observe);
  const conversationId = new URL(sender.url()).pathname.split("/").at(-1);
  assert.ok(conversationId, "Missing current conversation ID");
  const messagePath = `/conversations/${conversationId}/messages`;
  const routePattern = `**/api/v1${messagePath}`;
  const attempts = [];
  let committed;
  const loseResponse = async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    attempts.push(route.request().postDataJSON());
    const response = await route.fetch();
    assert.equal(response.ok(), true, `Message send failed (${response.status()})`);
    const message = await response.json();
    if (!committed) {
      committed = message;
      return route.abort("failed");
    }
    assert.equal(message.id, committed.id, "retry must return the committed message");
    return route.fulfill({ response });
  };
  try {
    const caption = `Ảnh Cloudinary thật ${stamp}`;
    console.log("Cloudinary acceptance: uploading one image with caption.");
    await sender.getByLabel("Thêm ảnh", { exact: true }).setInputFiles({
      name: "one.png",
      mimeType: "image/png",
      buffer: png,
    });
    await sender.getByPlaceholder("Viết tin nhắn…").fill(caption);
    await sender.getByRole("button", { name: "Gửi", exact: true }).click();
    const captionBubble = recipient
      .getByRole("list", { name: "Tin nhắn", exact: true })
      .locator("li")
      .filter({ hasText: caption });
    await captionBubble.getByRole("button", { name: "Xem ảnh 1", exact: true }).waitFor();
    await recipient.waitForFunction(() =>
      [...document.querySelectorAll(".mx-message-images img")].some(
        (image) => image.complete && image.naturalWidth > 0,
      ),
    );
    await sender.waitForFunction(
      () => document.querySelectorAll(".mx-message-attachments img").length === 0,
    );

    await sender.route(routePattern, loseResponse);
    console.log("Cloudinary acceptance: uploading five images and testing lost-response retry.");
    await sender.getByLabel("Thêm ảnh", { exact: true }).setInputFiles(
      [1, 2, 3, 4, 5].map((n) => ({
        name: `image-${n}.png`,
        mimeType: "image/png",
        buffer: png,
      })),
    );
    await sender.getByRole("button", { name: "Gửi", exact: true }).click();
    await sender.getByRole("alert").filter({ hasText: "Không thể gửi tin nhắn" }).waitFor();
    assert.equal(committed.type, "IMAGE");
    assert.equal(committed.body, "");
    assert.equal(committed.media.length, 5);
    assert.deepEqual(
      committed.media.map((item) => item.order),
      [0, 1, 2, 3, 4],
    );
    await sender.getByRole("button", { name: "Gửi", exact: true }).click();
    await sender.waitForFunction(
      () => document.querySelectorAll(".mx-message-attachments img").length === 0,
    );
    assert.equal(attempts.length, 2);
    assert.deepEqual(attempts[0], attempts[1], "retry must preserve the ordered payload and ID");
    await Promise.all(observations);
    assert.equal(uploads, 6, "retry must reuse all five successful uploads");
    await recipient.reload();
    await recipient.getByPlaceholder("Viết tin nhắn…").waitFor();
    const fiveImages = recipient.locator(".mx-message-images").last();
    await fiveImages.getByRole("button", { name: "Xem ảnh 5", exact: true }).waitFor();
    assert.equal(await fiveImages.getByRole("button").count(), 5);
    assert.equal(
      await recipient.locator(".mx-message-images").count(),
      initialGroups + 2,
      "history must contain one single-image and one grouped-image message",
    );
    console.log(
      "Real Cloudinary: caption + 1 image, 5 image-only, delivery/history and retry after lost commit response passed.",
    );
  } finally {
    sender.off("response", observe);
    await sender.unroute(routePattern, loseResponse);
    await Promise.allSettled(observations);
    const cleanup = await Promise.allSettled(
      [...assets].map(async (publicId) => {
        const result = await cloudinary.uploader.destroy(publicId, {
          resource_type: "image",
          invalidate: true,
        });
        assert.ok(["ok", "not found"].includes(result.result), "Test image cleanup failed");
      }),
    );
    assert.equal(
      cleanup.filter((result) => result.status === "rejected").length,
      0,
      "Could not clean up all test-owned Cloudinary images",
    );
    console.log(`Cloudinary cleanup: ${assets.size} test-owned images removed.`);
  }
}
