# Audit Minor Follow-ups — Design

## Intent

Close two deferred findings from the codebase audit: limit database lock/payload size while purging orphan tombstones, and make the unsupported-coordination browser recovery case deterministic. Success means retention cleanup still deletes eligible tombstones while preserving any referenced post, and the browser test proves both fallback refreshes submitted the same old cookie before either response rotates it.

## Goals

- Purge orphan tombstones in bounded batches, each in its own short transaction; repeat batches during one invocation until no eligible candidates remain.
- Retain the post-lock, fresh-statement relationship check so a concurrent reply cannot lose its parent/root.
- Replace the 30 ms scheduling delay in the browser fixture with an explicit rendezvous between both unsupported-coordination refresh requests.
- Keep test and database changes local to the current architecture; verify with unit tests, PostgreSQL integration, browser tests, and the full suite.

## Non-goals / anti-goals

- No schema or migration changes, no change to OTP/session/notification retention behavior, and no repair of historical orphaned references.
- No production authentication behavior changes and no broad browser-harness refactor.
- Do not weaken the post-parent/root relationship checks or make test success depend on longer sleeps/retries.
- Do not use a live or user database for integration verification.

## Constraints

- Continue using the existing Prisma raw SQL/repository conventions and loopback-only PostgreSQL integration guard.
- Lock at most 200 candidate tombstones per transaction. Recheck both `parentId` and `rootId` references in a distinct statement after locks are acquired.
- The next batch must be selected from currently eligible orphan candidates, so retained tombstones do not block later eligible rows.
- The browser fallback scenario has no BroadcastChannel or Web Locks; both refresh requests must arrive carrying the original cookie before the fixture releases either request.

## Approaches considered

1. **Drain bounded batches in one invocation (chosen):** each transaction locks up to 200 eligible candidates, rechecks relations and deletes them; continue with a fresh transaction until there are no candidates. This preserves the existing one-invocation cleanup behavior while bounding lock count, JSON ID transfer, and transaction lifetime.
2. **One bounded batch per invocation:** simpler strict cap on total work, but leaves eligible tombstones until a later scheduled run; rejected because it changes the retention worker's completion behavior.
3. **Keep one transaction and only chunk the ID payload:** rejected because it leaves the long lock duration that motivated the audit finding.

For the browser fixture, use a promise barrier for the two expected fallback refreshes rather than tuning the 30 ms delay. This makes the intended race explicit and fails with a clear timeout/assertion if the second request never arrives.

## Design details

- Candidate selection uses a bounded ordered query with `FOR UPDATE SKIP LOCKED`, filtered to deleted posts with no current direct child or root reference. For each returned locked ID batch, a separate DELETE statement repeats the relationship checks against its fresh statement snapshot. Transactions release locks after each batch. The worker returns the sum of deleted rows across batches.
- The existing final PostgreSQL integration coverage remains the authority for concurrent FK/thread relationships. Add a multi-batch case that demonstrates a run drains more than one batch and does not remove retained thread nodes.
- In the fallback browser route, count refresh requests and hold both at a shared barrier; record each request's cookie before release. Assert both observed the initial cookie and preserve the existing bounded fallback assertions. Coordinated refresh behavior remains unchanged.

## Open to the builder

- Keep the batch size as a named local constant (`200`) unless the existing SQL API requires an equivalent representation.
- Use the smallest test additions that demonstrate batching and deterministic fallback synchronization; do not add benchmark infrastructure or production telemetry solely for this minor.
