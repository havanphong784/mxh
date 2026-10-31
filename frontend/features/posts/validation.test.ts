import test from "node:test";
import assert from "node:assert/strict";
import { createPostSchema } from "./validation.ts";

test("createPostSchema rejects empty content without media", () => {
  const error = createPostSchema.validate({ content: "   ", media: [] });
  assert.equal(
    error,
    "Bài viết phải có nội dung chữ hoặc đính kèm ít nhất một hình ảnh/video.",
  );
});

test("createPostSchema accepts empty text if media is present", () => {
  const error = createPostSchema.validate({
    content: "",
    media: [{ url: "https://example.com/img.jpg" }],
  });
  assert.equal(error, null);
});

test("createPostSchema accepts text without media", () => {
  const error = createPostSchema.validate({
    content: "Xin chào mọi người!",
    media: [],
  });
  assert.equal(error, null);
});

test("createPostSchema rejects content exceeding 2000 characters", () => {
  const longContent = "a".repeat(2001);
  const error = createPostSchema.validate({ content: longContent });
  assert.equal(error, "Nội dung bài viết không được vượt quá 2000 ký tự.");
});

test("createPostSchema rejects more than 10 media attachments", () => {
  const media = Array.from({ length: 11 }, (_, i) => i + 1);
  const error = createPostSchema.validate({
    content: "Có quá nhiều ảnh",
    media,
  });
  assert.equal(error, "Chỉ được phép đính kèm tối đa 10 tệp phương tiện.");
});
