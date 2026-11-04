import assert from "node:assert/strict";
import test from "node:test";
import { queuePostInteraction } from "./interaction-queue.ts";

test("two changes to the same post interaction reach the server in click order", async () => {
  let finishFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => {
    finishFirst = resolve;
  });
  const started: string[] = [];
  const first = queuePostInteraction("post-1:like", async () => {
    started.push("like");
    await firstGate;
  });
  const second = queuePostInteraction("post-1:like", async () => {
    started.push("unlike");
  });

  await Promise.resolve();
  assert.deepEqual(started, ["like"]);
  finishFirst();
  await Promise.all([first, second]);
  assert.deepEqual(started, ["like", "unlike"]);
});
