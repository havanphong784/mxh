import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { executePurgeRetention } from "./purge-retention.js";

test("executePurgeRetention deletes expired OTPs, revoked sessions, old read notifications, and orphan tombstone posts", async () => {
  let executedQueries = 0;
  const mockTx = {
    execute: async (_plan: any) => {
      executedQueries++;
      return { affectedRows: 2 };
    },
  };

  const mockPrisma = {
    client: {
      raw: {
        sql: () => ({
          affectedCount: () => ({
            build: () => ({}),
          }),
        }),
      },
      transaction: async (callback: (tx: any) => Promise<unknown>) => {
        return callback(mockTx);
      },
    },
  };

  const result = await executePurgeRetention(mockPrisma as any);

  assert.equal(executedQueries, 4);
  assert.equal(result.deletedOtps, 2);
  assert.equal(result.deletedSessions, 2);
  assert.equal(result.deletedNotifications, 2);
  assert.equal(result.deletedTombstonePosts, 2);
});
