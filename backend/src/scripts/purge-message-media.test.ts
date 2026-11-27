import assert from "node:assert/strict";
import { test } from "node:test";
import { purgeMessageMedia } from "../messaging/message-media-cleanup.js";

test("orphan cleanup only reserves old message images and is inert in dry-run", async () => {
  const reserved: string[] = [],
    deleted: string[] = [];
  const dependencies = {
    pages: async function* () {
      yield [
        { publicId: "mxh/a/messages/old", createdAt: "2026-11-20T00:00:00Z" },
        { publicId: "mxh/a/messages/used", createdAt: "2026-11-20T00:00:00Z" },
        { publicId: "mxh/a/messages/new", createdAt: "2026-11-26T00:00:00Z" },
        { publicId: "mxh/a/posts/old", createdAt: "2026-11-20T00:00:00Z" },
      ];
    },
    reserve: async (id: string) => {
      reserved.push(id);
      return !id.endsWith("used");
    },
    remove: async (id: string) => {
      deleted.push(id);
    },
    complete: async () => {},
  };
  const dry = await purgeMessageMedia(dependencies, {
    dryRun: true,
    before: new Date("2026-11-25T00:00:00Z"),
  });
  assert.equal(dry.candidates, 2);
  assert.deepEqual(reserved, []);
  await purgeMessageMedia(dependencies, {
    dryRun: false,
    before: new Date("2026-11-25T00:00:00Z"),
  });
  assert.deepEqual(reserved, ["mxh/a/messages/old", "mxh/a/messages/used"]);
  assert.deepEqual(deleted, ["mxh/a/messages/old"]);
});

test("orphan cleanup retries persisted reservations even after the asset leaves inventory", async () => {
  const removed: string[] = [];
  const completed: string[] = [];
  const result = await purgeMessageMedia(
    {
      pages: async function* () {
        yield [];
      },
      pending: async function* () {
        yield ["mxh/a/messages/pending"];
      },
      reserve: async () => true,
      remove: async (id: string) => {
        removed.push(id);
      },
      complete: async (id: string) => {
        completed.push(id);
      },
    },
    { dryRun: false, before: new Date("2026-11-25T00:00:00Z") },
  );
  assert.deepEqual(removed, ["mxh/a/messages/pending"]);
  assert.deepEqual(completed, removed);
  assert.equal(result.deleted, 1);
});

test("orphan cleanup keeps failed deletions retryable and processes subsequent assets", async () => {
  const completed: string[] = [];
  const result = await purgeMessageMedia(
    {
      pages: async function* () {
        yield ["bad", "good"].map((name) => ({
          publicId: `mxh/a/messages/${name}`,
          createdAt: "2026-11-20T00:00:00Z",
        }));
      },
      reserve: async () => true,
      remove: async (id: string) => {
        if (id.endsWith("bad")) throw new Error("offline");
      },
      complete: async (id: string) => {
        completed.push(id);
      },
    },
    { dryRun: false, before: new Date("2026-11-25T00:00:00Z") },
  );
  assert.equal(result.failed, 1);
  assert.equal(result.deleted, 1);
  assert.deepEqual(completed, ["mxh/a/messages/good"]);
});
