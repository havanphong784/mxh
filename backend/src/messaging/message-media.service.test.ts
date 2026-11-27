import "reflect-metadata";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import type { MediaService } from "../media/media.service.js";
import { MessageMediaService } from "./message-media.service.js";

const secret = "message-media-test-secret";
process.env.CLOUDINARY_API_SECRET = secret;
process.env.CLOUDINARY_CLOUD_NAME = "test-cloud";
const input = (id = "one") => {
  const publicId = `mxh/alice/messages/${id}`;
  return {
    publicId,
    version: 123,
    signature: crypto
      .createHash("sha1")
      .update(`public_id=${publicId}&version=123${secret}`)
      .digest("hex"),
  };
};
function service(patch: Record<string, unknown> = {}) {
  return new MessageMediaService({
    getImageMetadata: async (publicId: string) => ({
      public_id: publicId,
      version: 123,
      resource_type: "image",
      type: "upload",
      format: "png",
      bytes: 10485760,
      width: 800,
      height: 600,
      ...patch,
    }),
  } as unknown as MediaService);
}

test("chat verifier accepts five ordered images at the byte limit and derives public URLs", async () => {
  const result = await service().verify("alice", ["a", "b", "c", "d", "e"].map(input));
  assert.equal(result.length, 5);
  assert.equal(result[4].order, 4);
  assert.equal(
    result[0].url,
    "https://res.cloudinary.com/test-cloud/image/upload/v123/mxh/alice/messages/a",
  );
  assert.equal(result[0].bytes, 10485760);
});

test("chat verifier rejects oversized, non-image, wrong-format and mismatched assets", async () => {
  for (const patch of [
    { bytes: 10485761 },
    { bytes: Number.NaN },
    { width: Number.NaN },
    { height: Infinity },
    { resource_type: "video" },
    { format: "svg" },
    { version: 124 },
    { public_id: "someone-else" },
  ]) {
    await assert.rejects(service(patch).verify("alice", [input()]));
  }
});

test("chat verifier rejects foreign ownership, signatures, duplicates and a sixth image", async () => {
  await assert.rejects(service().verify("bob", [input()]));
  await assert.rejects(service().verify("alice", [{ ...input(), signature: "bad" }]));
  await assert.rejects(service().verify("alice", [input(), input()]));
  await assert.rejects(service().verify("alice", ["a", "b", "c", "d", "e", "f"].map(input)));
});
