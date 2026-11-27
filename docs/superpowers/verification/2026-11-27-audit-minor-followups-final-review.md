# Audit minor follow-ups — final review, 2026-11-27

Both deferred audit findings are implemented on `fix/audit-minor-followups` in `/mnt/data/Code/mxh/.worktrees/audit-minor-followups`. The branch is based on `d2a25c8f75cbe2fe64e3d11475e07ebb11f9b662` (`main`). No merge or push was performed.

- Plan: [Audit minor follow-ups](../plans/2026-11-27-audit-minor-followups-plan.md).
- Spec: [Audit minor follow-ups design](../specs/2026-11-27-audit-minor-followups-design.md).
- `8ea3378`: `perf(retention): purge orphan tombstones in batches`.
- `fc2c1de`: `test(auth): synchronize fallback refresh fixture`.

## Implementation and RED → GREEN evidence

Retention selects at most 200 currently orphan-eligible tombstones, ordered by ID, with `FOR UPDATE SKIP LOCKED`. Each non-empty batch deletes only its locked IDs after rechecking both parent/root references in a separate statement. Every batch transaction completes before the next starts; counts are accumulated until an empty selection. OTP/session/notification cleanup retains its predicates and executes once, before the tombstone loop. No schema or migration changes were made.

The new real-PostgreSQL regression creates 201 orphan tombstones scoped to an existing fixture author and records actual candidate result sizes/transaction identities. Before implementation it failed with one batch of 208 IDs: 201 orphans and seven retained ancestors from earlier cases. After implementation all 201 fixture rows are gone, each selection is at most 200, non-empty batches use distinct non-overlapping transactions, and the last selection is empty. All seven pre-existing retention cases still pass. The retention unit double now provides two finite non-empty batches followed by an empty batch and checks aggregated results.

The test-only arrival barrier blocks the first fallback request until its peer arrives and rejects if the peer misses a configured timeout. Tests first failed because the helper module did not exist, then passed after implementation. The timeout test has its own 1-second bound around a configured 20-ms barrier timeout. The browser fixture records both submitted cookie headers before the barrier and asserts both contained `refresh=initial` before allowing either response to rotate the cookie. The coordinated route retains its existing behavior, and production auth/socket code is unchanged.

## Whole-branch review

Final review: self-review (no subagent tool).

Reviewed the generated whole-branch package for `d2a25c8..fc2c1de` in a separate pass after both task completion records. Used the requesting-code-review checklist and all five Review Focus items from the plan. An author self-review is weaker than an independent reviewer; this report does not claim independent review.

1. **More than 200 eligible tombstones:** real SQL regression verifies complete drain, bounded candidate sizes, transaction separation, and empty-selection termination.
2. **Descendants, stale counters, concurrent replies:** existing real PostgreSQL tests preserve direct-child/root-only references, deep threads, stale counter behavior, concurrent insertion, and root access rules. SQL review confirms the post-lock DELETE still rechecks relationships with a fresh statement and limits deletion to locked IDs.
3. **Retained ancestors and termination:** candidate selection filters both relationship types before `ORDER BY`/`LIMIT`; retained ancestors cannot fill candidate slots. The loop terminates on candidate count rather than deleted count, allowing a batch whose newly protected rows survive to be followed by a fresh candidate scan. Rows locked elsewhere are skipped and may be collected by a subsequent invocation, as documented in the runbook.
4. **Fallback cookie race:** both headers are captured and checked against the literal initial cookie before rotation; the test no longer relies on a scheduling sleep in the unsupported path.
5. **Coordinated and fallback outcomes:** repeated Chromium runs verify one cold coordinated refresh, one additional coordinated rotation for two rejected requests, two fallback refreshes with the original cookie, exactly one fallback sign-in screen, and existing draft/socket teardown behavior.

Critical: none. Important: none. Minor: none. Declined to judge: none. No final fix pass was needed.

## Final verification

| Gate                                                   | Result                                                                                                                                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test -- --force`                                  | Pass: frontend 66/66, backend 179/179; 2 tasks successful, 0 cached                                                                                                           |
| `npm run test:retention -w backend`                    | Pass: 4/4                                                                                                                                                                     |
| Loopback PostgreSQL `test:posts:retention:integration` | Pass: 8/8, including 201-row regression; rerun after both implementation commits                                                                                              |
| Focused arrival barrier tests                          | Pass: 2/2                                                                                                                                                                     |
| `npm run test:browser -w frontend` repeated            | Five consecutive fully completed runs after the initial command-window interruption: background runs 2–5 each exited 0, followed by the task-completion browser run exiting 0 |
| `npm run lint -- --force`                              | Exit 0; 0 errors; existing Biome 753 warnings/9 infos and backend ESLint 536 warnings; 0 cached tasks                                                                         |
| `npm run format:check`                                 | Pass                                                                                                                                                                          |
| `npm run build -w frontend`                            | Pass: frontend typecheck and Vite production build                                                                                                                            |
| `npm exec -w backend -- tsc --noEmit`                  | Pass                                                                                                                                                                          |
| `git diff --check`                                     | Pass                                                                                                                                                                          |

The initial browser run also completed successfully. A foreground loop then reached the command tool's 60-second limit during its second run; its process exit was not counted. Repeated runs were restarted with persistent exit records, and five subsequent runs completed without a failing scenario. No timeout increase or additional retry was introduced into the fixture.

PostgreSQL was initialized specifically for this plan, bound only to `127.0.0.1:55489`, using database `mxh_followups_test`; all five existing migrations were applied to that disposable database. No user/live database or cloud service was used. Browser tests use real React, BroadcastChannel, Web Locks, cookies, and Socket.IO with REST fixtures in Chromium; they are not full backend HTTP auth integration or certification of every browser. Node still emits the existing SWC `DEP0205` deprecation warning.

## Rulings I made

1. **Task 2:** The plan imports a new `.mjs` helper from a strict TypeScript test but omits its declaration. Added `checks/async-barrier.d.mts` with the exact specified signature instead of weakening `tsconfig` or suppressing TS7016. The frontend build failed TS7016 before this addition and passed afterward. **Cost if wrong:** the declaration must stay aligned with the helper.

## Deferred minors

None.

## Handoff

Both implementation tasks and final gates are complete. Preserve the branch and linked worktree pending the user's integration decision. Stop the disposable PostgreSQL and Vite processes, then remove only this plan's ignored execution workspace after committing this report, the completed plan, and its design. Other plans' workspaces remain untouched.
