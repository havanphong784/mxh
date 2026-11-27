// HISTORICAL EVIDENCE ONLY — probes for the pre-fix audit at 762553f.
// These assertions intentionally describe defects and are NOT a regression gate.
// Run only against the pre-fix sources. The maintained regressions are in
// frontend/checks/platform.test.ts, frontend/checks/auth-browser.mjs,
// backend/src/auth/auth.integration.ts, backend/src/posts/posts-retention.integration.ts,
// and backend/src/posts/posts.service.test.ts.
// Run from repository root (backend cwd supplies the decorator-enabled tsconfig):
// cd backend && node --import @swc-node/register/esm-register ../docs/superpowers/verification/2026-11-27-codebase-audit-repro.mjs
// No database, browser, network or Cloudinary access; all external boundaries are fixtures.
import "reflect-metadata";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { AuthService } from "../../../backend/src/auth/auth.service.ts";
import { PostsRepository } from "../../../backend/src/posts/posts.repository.ts";
import { PostsService } from "../../../backend/src/posts/posts.service.ts";
import { executePurgeRetention } from "../../../backend/src/scripts/purge-retention.ts";
import { createOrmTestClient } from "../../../backend/src/testing/orm-test-client.ts";
import { createClient } from "../../../frontend/src/api.ts";

function peers() {
  const listeners = new Set();
  return () => {
    let own;
    return {
      publish(message) {
        for (const listener of listeners) if (listener !== own) listener(message);
      },
      subscribe(listener) {
        own = listener;
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
  };
}

// F1: two tabs retain the same rejected token and never reach refresh HTTP.
{
  const endpoint = peers();
  let refreshes = 0;
  const transport = async (url) => {
    if (String(url).endsWith("/auth/refresh")) {
      refreshes++;
      return Response.json({ accessToken: "fresh" });
    }
    return new Response(null, { status: 401 });
  };
  const a = createClient("", transport, endpoint());
  const b = createClient("", transport, endpoint());
  a.setToken("expired");
  await assert.rejects(a.request("/private"), { status: 401 });
  assert.equal(refreshes, 0);
  assert.equal(a.getToken(), "expired");
  a.dispose();
  b.dispose();
  console.log("F1 confirmed: rejected peer token reused; refresh HTTP calls = 0");
}

// F2: a login/token message for another user silently changes the next write's identity.
{
  const endpoint = peers();
  let sent;
  const transport = async (_url, init) => {
    sent = new Headers(init?.headers).get("Authorization");
    return Response.json({ ok: true });
  };
  const a = createClient("", transport, endpoint());
  const b = createClient("", transport, endpoint());
  a.setToken("account-A");
  b.setToken("account-B");
  await a.request("/posts", { method: "POST", body: { content: "draft from A" } });
  assert.equal(sent, "Bearer account-B");
  b.setToken(null);
  assert.equal(a.getToken(), "account-B");
  a.dispose();
  b.dispose();
  console.log("F2 confirmed: tab A writes with B token; clearing B is not broadcast");
}

// F3: both OTP flows snapshot attempts and overwrite the same increment.
for (const method of ["verifyOtp", "resetPassword"]) {
  let attempts = 0;
  const facade = {
    async findLatestOtp() {
      return {
        id: "otp",
        attempts,
        codeHash: createHash("sha256").update("123456").digest("hex"),
        expiresAt: new Date(Date.now() + 60000),
      };
    },
    async incrementOtpAttempts(_id, value) {
      attempts = value;
    },
  };
  const service = new AuthService({}, {}, {}, {}, facade);
  const results = await Promise.allSettled(
    Array.from({ length: 5 }, () =>
      service[method]({ email: "audit@example.test", code: "000000", newPassword: "unused" }, {}),
    ),
  );
  assert.equal(results.filter((item) => item.status === "rejected").length, 5);
  assert.equal(attempts, 1);
  console.log(`F3 confirmed (${method}): 5 rejected guesses recorded as 1 attempt`);
}

// F4: edit response drops previously true viewer flags.
{
  const author = {
    id: "owner",
    username: "owner",
    displayName: "Owner",
    isActive: true,
    isEmailVerified: true,
  };
  const post = {
    id: "post",
    authorId: "owner",
    author,
    content: "before",
    visibility: "PUBLIC",
    media: [],
    isDeleted: false,
  };
  let markReads = 0;
  const repo = {
    async findByIdWithAuthorAndMedia() {
      return post;
    },
    async updatePostAndReplies(_id, payload) {
      Object.assign(post, payload);
    },
    async findByIdForResponse() {
      return post;
    },
    async findViewerMarks() {
      markReads++;
      return { likes: [{ postId: "post" }], bookmarks: [{ postId: "post" }], reposts: [] };
    },
  };
  const service = new PostsService(repo, {}, {}, { async ensureActiveUser() {} });
  const before = await service.getPostById("post", "owner");
  const after = await service.updatePost("post", "owner", { content: "after" });
  assert.equal(before.interactions.isLiked, true);
  assert.equal(before.interactions.isBookmarked, true);
  assert.equal(after.interactions.isLiked, false);
  assert.equal(after.interactions.isBookmarked, false);
  assert.equal(markReads, 1);
  console.log(
    "F4 confirmed: editing flips liked/bookmarked response flags to false without deleting marks",
  );
}

// F5: compile the real counter query, and inspect the real purge plan.
// This proves the incompatible predicates, not an end-to-end PostgreSQL deletion.
{
  const { prisma, plans } = createOrmTestClient({ query: () => [], execute: () => 0 });
  await new PostsRepository(prisma).countPostRelationsForPosts(["root"]);
  const replyCountPlan = plans.find((plan) =>
    JSON.stringify(plan.ast).includes('"column":"parentId"'),
  );
  assert.ok(replyCountPlan);
  assert.ok(JSON.stringify(replyCountPlan.ast).includes('"column":"isDeleted"'));
  assert.ok(replyCountPlan.params.includes(false));
  const purgeSql = [];
  const fixture = {
    client: {
      raw: {
        sql(parts, ...values) {
          const text = parts.reduce(
            (all, part, index) => all + part + (index < values.length ? "?" : ""),
            "",
          );
          return {
            affectedCount() {
              return this;
            },
            build() {
              return { text };
            },
          };
        },
      },
      async transaction(work) {
        return work({
          async execute(plan) {
            purgeSql.push(plan.text);
            return { affectedRows: 0 };
          },
        });
      },
    },
  };
  await executePurgeRetention(fixture);
  const tombstones = purgeSql.find((sql) => sql.includes('DELETE FROM "post"'));
  assert.match(tombstones, /"replyCount" = 0/);
  assert.doesNotMatch(tombstones, /NOT EXISTS|parentId|rootId/);
  console.log(
    "F5 predicates confirmed: reconciler excludes deleted children; purge trusts replyCount without checking descendants",
  );
}
console.log(
  "Audit probes completed. These confirmations describe current bugs; they are not passing regression tests for fixes.",
);
