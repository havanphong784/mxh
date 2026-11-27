# Audit Minor Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Close the two deferred audit minors by bounding tombstone purge transactions and making the browser fallback refresh race deterministic.

**Architecture:** Keep the existing PostgreSQL relationship/locking invariant while processing up to 200 eligible tombstones per transaction and draining batches until no candidates remain. Replace timer-based browser race simulation with a small test-only arrival barrier; production auth behavior stays unchanged.

**Tech Stack:** TypeScript, Prisma raw SQL, PostgreSQL, Node test runner, Playwright.

**Spec:** [Audit Minor Follow-ups design](../specs/2026-11-27-audit-minor-followups-design.md)

## Global Constraints

- Do not change database schema or migrations.
- Never delete a post with a current direct child or root reference; recheck relationships in a fresh statement after row locks are held.
- Lock at most 200 orphan-tombstone candidates in one transaction; release the transaction before selecting the next batch.
- Preserve all existing OTP/session/notification retention results and browser refresh assertions.
- Use only a loopback disposable PostgreSQL database for integration tests; no live/user database and no cloud calls.
- Do not change production authentication or socket lifecycle code for the browser-test follow-up.

## Review Focus

1. A run with more than 200 eligible tombstones drains all of them while no batch query returns or locks more than 200 candidates.
2. A tombstone with descendants, a stale counter, or a reply committed during purge remains linked and keeps the existing access rules.
3. Eligible orphan tombstones are not starved behind retained tombstones, and repeated batch transactions terminate when no eligible candidate remains.
4. In browsers without BroadcastChannel/Web Locks, both refresh requests are confirmed to have submitted the initial cookie before either fixture response rotates it.
5. The coordinated browser case still rotates once; unsupported fallback still terminates with the existing bounded sign-in outcome.

## Pre-flight

Pre-flight: no shared interfaces. Task 1 changes backend purge behavior; Task 2 changes only frontend test support and browser fixtures.

---

### Task 1: Drain orphan tombstones in bounded transactions

**Files:**

- Modify: `backend/src/scripts/purge-retention.ts`.
- Modify: `backend/src/scripts/purge-retention.test.ts`.
- Modify: `backend/src/posts/posts-retention.integration.ts`.
- Modify: `docs/05-runbook-deploy.md`.

**Interfaces:**

- Keep `executePurgeRetention(prisma): Promise<PurgeRetentionResult>` and its result shape unchanged.
- Keep the per-batch lock selection and relationship recheck private to the retention script; use a named batch-size constant of 200.

- [x] **Step 1: Add the real-DB regression first.** In `posts-retention.integration.ts`, create 201 orphan tombstones for an existing fixture user. Wrap the real Prisma transaction only to record the number of rows returned by each candidate-lock query. Run the real purge and assert all 201 rows are deleted, every candidate batch is at most 200 IDs, and candidate processing spans multiple transactions. Keep fixture cleanup scoped to the integration's created user.
- [x] **Step 2: Run the integration to verify RED.** Start/use a disposable migrated loopback test DB and run `NODE_ENV=test POSTS_TEST_DATABASE_URL=<loopback-test-url> npm run test:posts:retention:integration -w backend`. Expected: the current all-at-once lock query returns 201 IDs, so the batch-bound assertion fails; existing retention integration cases continue to pass.
- [x] **Step 3: Implement the bounded drain.** Select at most 200 currently orphan-eligible tombstones ordered by ID with `FOR UPDATE SKIP LOCKED`. For every non-empty selection, use a separate DELETE statement to recheck both `parentId` and `rootId` relations under the acquired locks; run each batch in its own transaction and aggregate affected rows. Continue with a fresh candidate query until it returns no rows. Keep the existing OTP/session/notification deletion behavior intact. Update the retention unit double to return a finite candidate sequence, and document batch/transaction behavior in the runbook.
- [x] **Step 4: Verify GREEN.** Run `npm run test:retention -w backend`, the full `test:posts:retention:integration` command against the disposable DB, `npm exec -w backend -- tsc --noEmit`, and `npm test -w backend`. Expected: all old thread/counter/concurrency invariants pass, 201 orphan tombstones are drained across bounded batches, and no transaction holds locks across a subsequent batch.
- [x] **Step 5: Review and commit Task 1.** Inspect the SQL and test diff; run `git diff --check`; commit as `perf(retention): purge orphan tombstones in batches`.

### Task 2: Synchronize the unsupported browser refresh fixture

**Files:**

- Create: `frontend/checks/async-barrier.mjs`.
- Modify: `frontend/checks/platform.test.ts`.
- Modify: `frontend/checks/auth-browser.mjs`.

**Interfaces:**

- Add test-only `createArrivalBarrier(expectedArrivals: number, timeoutMs?: number): () => Promise<void>` in `async-barrier.mjs`.
- Do not change production APIs or refresh/socket behavior.

- [x] **Step 1: Write failing helper tests.** In `platform.test.ts`, import `createArrivalBarrier(2)` and test that the first arrival remains pending until the second arrives, after which both resolve. Also test that a missing arrival rejects with the configured bounded timeout. Expected: tests fail because the helper does not yet exist.
- [x] **Step 2: Run the focused tests to verify RED.** From `frontend/`, run `node --test --test-name-pattern='arrival barrier' checks/platform.test.ts`. Expected: fail specifically because `createArrivalBarrier` is unavailable, not from test setup.
- [x] **Step 3: Implement the test-only barrier and use it in the browser fixture.** The barrier releases only after the expected number of arrivals and rejects after a bounded timeout if the peer request never arrives. In the unsupported-coordination route, record each request's submitted cookie before waiting; replace the 30 ms sleep with the two-arrival barrier and assert both saw the original cookie before rotation. Keep the coordinated path and existing final outcome assertions unchanged.
- [x] **Step 4: Verify GREEN and repeat the browser scenario.** Run the focused barrier test, `npm test -w frontend`, then start Vite and run `npm run test:browser -w frontend` five consecutive times. Expected: all tests pass; each browser run confirms one coordinated refresh, two concurrent fallback requests with the original cookie, bounded fallback, and clean socket lifecycle.
- [x] **Step 5: Review and commit Task 2.** Inspect that changes are confined to test support/fixtures; run `git diff --check`; commit as `test(auth): synchronize fallback refresh fixture`.

## Final Gates

- [x] `npm test -- --force` passes without cached tasks.
- [x] `npm run lint -- --force`, `npm run format:check`, frontend production build, and backend `tsc --noEmit` pass.
- [x] PostgreSQL retention integration and five repeated browser runs pass on the branch.
- [x] Review the whole branch against this plan and design; record any remaining minor findings rather than expanding scope.
