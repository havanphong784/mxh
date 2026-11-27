# Codebase Bugfix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sửa bốn nhóm lỗi đã tái hiện và xác minh/sửa rủi ro cleanup thread mà audit phát hiện.

**Architecture:** Giữ React/Vite, NestJS và repository boundaries hiện tại. Sửa tại nguồn: đồng bộ vòng đời auth giữa tab, claim OTP nguyên tử, response posts theo viewer, và cleanup dựa trên quan hệ thật. Không thay schema hoặc nâng dependency nếu các test không chứng minh cần thiết.

**Tech Stack:** TypeScript, React 19/Vite 8, NestJS 12/Fastify, Prisma 8 RC đã ghim, PostgreSQL, Node test runner, Playwright.

**Spec:** [Báo cáo audit và bằng chứng](../verification/2026-11-27-codebase-audit.md), giữ nguyên như snapshot trước sửa tại `762553f`.

**Trạng thái thực thi:** Cả 5 task đã được triển khai và kiểm chứng. Final review cùng regression AbortSignal được ghi tại [báo cáo review cuối](../verification/2026-11-27-codebase-bugfix-final-review.md). Các checkbox chi tiết bên dưới giữ checklist kế hoạch gốc; ledger ghi bằng chứng thực thi. Các bước commit vẫn chờ yêu cầu riêng; chưa commit/push.

## Global Constraints

- Chỉ sửa lỗi đã có regression red; không gộp redesign, nâng dependency hoặc cleanup warnings hàng loạt.
- Không thay migration đã commit. Nếu cần schema change, lập migration roll-forward riêng và review lại phạm vi.
- Frontend không import backend code; các tests audit liên tầng không được đưa vào production bundle.
- Controller không truy cập DB; auth dùng Users facade và repository.
- Không dùng database hoặc cloud có dữ liệu cần giữ để test. Không tự chạy seed/purge/migration trên môi trường hiện có.
- Access token chỉ ở bộ nhớ; không đưa token vào localStorage/sessionStorage hoặc ghi vào log.
- Không giữ transaction trong SMTP/Cloudinary/WebSocket I/O.
- Chưa commit/push khi chỉ mới có yêu cầu đọc và lập plan.

## Review Focus

1. Đổi tài khoản hoặc logout khi tab khác đang có draft/request: không replay mutation dưới danh tính mới — Task 1.
2. OTP tại attempts=4, request song song, OTP hết hạn hoặc đã bị consume: tối đa một lượt còn lại và không tạo hai kết quả thành công — Task 2.
3. Hai tab cùng nhận 401, bootstrap lạnh, peer im lặng hoặc thiếu BroadcastChannel: phục hồi có giới hạn, không giữ mãi token bị từ chối — Task 3.
4. Thread sâu R→A→B, tombstone và counter lệch, xóa đồng thời tạo reply: không bỏ root đang còn descendants hoặc đổi quyền truy cập — Task 4.
5. PATCH bài có đủ viewer marks, không có marks hoặc visibility thay đổi: response tương tác phải khớp GET — Task 5.

## Bản đồ file và thứ tự

| Task   | Phạm vi chính                                                                                           | Phụ thuộc                  |
| ------ | ------------------------------------------------------------------------------------------------------- | -------------------------- |
| 1 / F2 | `frontend/src/api.ts`, `frontend/src/app.tsx`, platform/browser checks                                  | Không                      |
| 2 / F3 | AuthService → UsersAuthService → UsersRepository, auth/repository tests                                 | Không                      |
| 3 / F1 | `frontend/src/api.ts`, `frontend/src/realtime.ts` nếu test chỉ ra cần, platform/realtime/browser checks | Task 1, cùng auth protocol |
| 4 / F5 | PostsRepository, reconciler, purge-retention, DB regression mới                                         | Xác nhận DB trước bản sửa  |
| 5 / F4 | `backend/src/posts/posts.service.ts`, service tests                                                     | Không                      |

Thực hiện nối tiếp trong phiên hiện tại nếu chưa có subagent tool. Không cần worktree để đọc/lập plan; khi bắt đầu sửa, kiểm tra workspace và chọn isolation theo skill tương ứng.

---

### Task 1: Ngăn đổi danh tính ngầm qua BroadcastChannel — F2 / P1

**Files:**

- Modify: `frontend/src/api.ts:1–24,103–137,153–220`.
- Modify: `frontend/src/app.tsx:74–97,170–192`.
- Test: `frontend/checks/platform.test.ts`.
- Test: `frontend/checks/browser.test.mjs` hoặc file helper browser riêng được runner gọi.

**Interfaces:**

- Giữ `createClient(origin, transport?, providedAuthSync?)`, `setToken(next)`, `request(path, options)`, `onExpired(callback)`.
- Mở rộng `AuthSyncMessage` với `{ type: "session-changed" }` và `{ type: "session-ended" }`; không broadcast lại sự kiện vừa nhận.
- Quyết định đề xuất: login/logout chủ động ở một tab làm các tab đang có phiên cũ clear state và yêu cầu thiết lập lại phiên. Không tự thay token của tài khoản đang hiển thị bằng token tài khoản khác. Bootstrap chưa có user vẫn có thể hỏi peer token; peer token chỉ được dùng sau xác minh `/auth/me` trước khi dựng private UI.
- Refresh token bình thường vẫn dùng thông điệp token; chỉ nhận cập nhật thuộc cùng subject/phiên đã biết. Metadata JWT phía client chỉ là hint phân loại; backend xác minh chữ ký và quyền.

- [ ] **Step 1: Viết regression tests.** `peer_login_invalidates_existing_identity_before_next_write`: sau A→B login, A không được gửi `Bearer B` cho draft cũ; quan sát callback clear session. `peer_logout_clears_other_tab_once`: clear token và callback đúng một lần, không echo loop. `late_response_from_old_identity_is_aborted`: response cũ không trở lại private state. Thêm browser fixture giữ form A mở, login B ở tab khác và xác nhận shell/socket cũ được tháo trước thao tác tiếp theo.
- [ ] **Step 2: Chạy để xác nhận red.** `npm test -w frontend`. Test mới phải fail vì hiện token bị thay ngầm hoặc logout không phát sự kiện; không coi lỗi setup là red hợp lệ.
- [ ] **Step 3: Sửa protocol và lifecycle.** Tách sự kiện thay phiên khỏi refresh, clear token/epoch trước callback UI; để `App` vô hiệu startup cũ, tháo shell/socket. Không retry mutation nếu session epoch đổi. Giữ single-flight và bảo vệ late response đang có.
- [ ] **Step 4: Kiểm tra green.** `npm test -w frontend`, `npm run lint -w frontend`, `npm run build -w frontend`; chạy `npm run test:browser -w frontend` với Vite local theo README. Browser case phải kiểm tra UI identity và Authorization, không chỉ token string trong model.
- [ ] **Step 5: Review diff riêng Task 1.** Khi đã có quyền commit, commit riêng `fix(auth): invalidate peer tabs when account session changes`.

### Task 2: Claim lượt thử OTP nguyên tử — F3 / P1

**Files:**

- Modify: `backend/src/auth/auth.service.ts:119–160,440–472`.
- Modify: `backend/src/users/users-auth.service.ts:62–80`.
- Modify: `backend/src/users/users.repository.ts:68–85,108–149` nếu single-use test thất bại.
- Test: `backend/src/auth/auth.service.test.ts`, `backend/src/users/users.repository.test.ts`.
- Create test: `backend/src/auth/auth.integration.ts` và script `test:auth:integration` trong `backend/package.json`.

**Interfaces:**

- Thêm Users facade/repository `claimOtpAttempt(otpId: string): Promise<ClaimedOtp | null>`.
- `ClaimedOtp = { id: string; codeHash: string; attempts: number; expiresAt: Temporal.Instant; userId: string | null }`.
- Claim SQL nguyên tử: đúng ID, `attempts < 5`, `expiresAt > CURRENT_TIMESTAMP`; tăng `attempts = attempts + 1`, trả bản ghi sau claim. Null nghĩa không còn lượt/không hợp lệ và không được tiếp tục so mã hoặc thay đổi tài khoản.
- Public methods `verifyOtp(dto, meta)` và `resetPassword(dto)` giữ DTO; các kết quả thành công vẫn qua repository transaction hiện có.
- Integration mới áp dụng guard loopback + `NODE_ENV !== production` như `messaging.integration.ts`, dùng `AUTH_TEST_DATABASE_URL` riêng. Fixture tạo/xóa đúng tài khoản test; không reset schema.

- [ ] **Step 1: Viết red tests.** `parallel_wrong_otp_claims_do_not_lose_attempts` chạy cho cả hai flow; 5 request sai từ attempts=0 phải ghi đủ 5, lượt 6 không được so mã. `only_one_claim_remains_at_four_attempts` cho nhiều request song song: chỉ một claim thành công. OTP hết hạn không claim được. Test hai request cùng mã đúng chỉ có một lần consume và một kết quả thành công; nếu hiện tại single-use đã đúng, giữ test bảo vệ, không sửa thêm.
- [ ] **Step 2: Chạy red.** `npm run test:auth -w backend` và `npm run test:users -w backend`; integration mới với DB riêng đã có schema. Chứng minh lost-update bằng PostgreSQL thật trước khi kết luận race đã sửa.
- [ ] **Step 3: Thay snapshot increment bằng claim.** Đưa điều kiện và phép tăng vào một DB statement, đưa type qua facade, bỏ truyền `otpRecord.attempts + 1` từ service. Nếu test consume fail, claim việc consume trong cùng transaction cập nhật user/session và rollback khi claim không thành công. Không phát token/event từ một consume thất bại.
- [ ] **Step 4: Chạy green.** Chạy auth/users unit + integration mới; `npm exec -w backend -- tsc --noEmit`. Kiểm tra code OTP không xuất hiện trong logs và SMTP vẫn ở ngoài transaction.
- [ ] **Step 5: Review diff riêng Task 2.** Khi đã có quyền commit: `fix(auth): claim otp attempts atomically`.

### Task 3: Phục hồi phiên nhiều tab sau 401 — F1 / P1

**Files:**

- Modify: `frontend/src/api.ts:139–220`.
- Test: `frontend/checks/platform.test.ts`, `frontend/checks/realtime.test.ts`.
- Test: browser checks cho nhiều tab và fixture refresh-cookie rotation.
- Modify: `frontend/README.md` nếu ma trận hỗ trợ thay đổi.

**Interfaces:**

- Giữ public `refresh(): Promise<string | null>` và `request<T>(path, options)`.
- Nội bộ thêm `refreshAfterUnauthorized(rejectedToken: string): Promise<string | null>`; request chỉ replay tối đa một lần và không replay nếu session epoch Task 1 đã đổi.
- Thêm `rejectedToken?: string` vào thông điệp `request-token`; responder không trả token đó hoặc token đã hết hạn. Waiter bỏ qua token không dùng được và tiếp tục chờ trong thời hạn, thay vì resolve thành công.
- Dùng Web Locks khi có để serialize thao tác refresh cookie giữa các tab. Sau khi lấy lock, kiểm tra lại token vừa được peer cập nhật trước HTTP refresh. Không giữ nguyên logic `generation` coi refresh cùng danh tính là đổi tài khoản.
- Khi thiếu khả năng điều phối, fallback phải giới hạn retry và kết thúc rõ ràng bằng đăng nhập lại nếu không phục hồi an toàn; không quảng bá hỗ trợ cold-start mọi browser khi chưa test.

- [ ] **Step 1: Viết red tests.** Hai peer cùng token expired phải tạo đúng một HTTP refresh trong môi trường có coordinator và request trả dữ liệu mới. Token khác nhưng đã hết `exp` cũng không được dùng. Peer im lặng phải tiến tới refresh/failure hữu hạn. Mock thiếu BroadcastChannel/Web Locks; kiểm tra không lặp vô hạn. Đổi identity trong lúc chờ lock phải abort, không replay write. Browser hai tab khởi động lạnh dùng cookie chung phải đạt hoặc hiện trạng thái phục hồi rõ ràng theo capability đã công bố.
- [ ] **Step 2: Chạy red.** `npm test -w frontend`; ca hai token expired phải fail ở số HTTP refresh hoặc kết quả request, như probe F1.
- [ ] **Step 3: Sửa selection và coordination.** Loại token đã bị từ chối, kiểm tra thời hạn trước peer reuse, serialize refresh và kiểm tra lại epoch trước/sau chờ. Duy trì idempotency key, AbortSignal và giới hạn một replay. Token metadata không thay thế kiểm tra JWT ở server.
- [ ] **Step 4: Chạy green.** Frontend unit/realtime + browser multi-tab; lint/build frontend. Kiểm tra thêm socket recovery không tạo refresh storm và không reconnect sau logout. Chỉ chạy live test với DB riêng được chỉ định, không mặc định dùng backend đang chạy.
- [ ] **Step 5: Review diff riêng Task 3.** Khi đã có quyền commit: `fix(auth): refresh rejected tokens safely across tabs`.

### Task 4: Xác minh rồi bảo vệ tombstone còn descendants — F5 / P1

**Files:**

- Modify: `backend/src/posts/posts.repository.ts:529–612,649–695,796–814`.
- Modify: `backend/src/posts/posts.service.ts:1009–1083` và repository listing nếu cần đối soát tombstone.
- Modify: `backend/src/scripts/purge-retention.ts:39–45`.
- Test: `backend/src/posts/posts.repository.test.ts`, `backend/src/posts/posts.service.test.ts`, `backend/src/scripts/purge-retention.test.ts`.
- Create: `backend/src/posts/posts-retention.integration.ts`; add `test:posts:retention:integration` vào `backend/package.json`.
- Update: `docs/05-runbook-deploy.md` với invariant và lệnh đối soát an toàn.

**Interfaces:**

- Giữ `countPostRelations(postId)` và `countPostRelationsForPosts(postIds)` trả cùng shape.
- Chốt `replyCount` là số direct reply rows còn giữ trong cây, gồm tombstone chưa dọn do có descendants. Không dùng counter để quyết định một node có mồ côi thật hay không.
- Cleanup/purge kiểm tra không có direct child và không có row tham chiếu root đang bị xóa, trong transaction; xem xét row locks và FK để concurrent insert không làm mất liên kết.
- Nếu cần listing mới: `listPostsForCounterReconciliation(targetPostId?: string)` trả cả active và retained tombstone; chia batch như pipeline hiện tại. Không đổi âm thầm ý nghĩa `listActivePosts()` dùng chỗ khác.
- Integration dùng `POSTS_TEST_DATABASE_URL`, guard loopback/non-production và fixture IDs; không gọi Cloudinary thật.

- [ ] **Step 1: Viết integration red trước.** Tạo R FOLLOWERS của user R, A của user A và B của user B trong cùng thread. Xóa A → reconcile R → xóa R → chạy `executePurgeRetention()`. Assert R và rootId/parentId cần thiết còn giữ; viewer chỉ follow B vẫn bị từ chối xem B. Thêm counter bị đặt sai 0, xóa sibling, depth>3 và concurrent reply insert. Từng ca phải kiểm tra tồn tại row, quan hệ và quyền sau cleanup.
- [ ] **Step 2: Xác nhận bằng DB thật.** Chạy `npm run test:posts:retention:integration -w backend` với DB test đã có migrations. Nếu chuỗi không tái hiện, đọc hành vi ORM/trigger/FK và cập nhật giả thuyết trước khi sửa; không nâng mức chắc chắn chỉ từ probe predicate.
- [ ] **Step 3: Sửa invariant và cleanup nếu red được xác nhận.** Đồng bộ hai hàm counter với nghĩa trên; bảo vệ hard delete bằng quan hệ thật trong cả cleanup tức thời và purge. Đối soát retained tombstone. Không sửa migration cũ hoặc xóa descendants để làm test xanh. Ghi hướng dẫn kiểm tra dữ liệu đã orphan; không tự chạy repair lên DB người dùng.
- [ ] **Step 4: Chạy green.** Posts/retention unit + integration mới, backend type-check, frontend social tests. Kiểm tra thread đã xóa vẫn mở được con, node thực sự mồ côi vẫn được dọn và không tạo counter âm. Kiểm tra kế hoạch khóa không đặt network I/O trong transaction.
- [ ] **Step 5: Review diff riêng Task 4.** Khi đã có quyền commit: `fix(posts): preserve thread roots during tombstone cleanup`.

### Task 5: Response sửa bài giữ viewer marks — F4 / P2

**Files:**

- Modify: `backend/src/posts/posts.service.ts:153–191`.
- Test: `backend/src/posts/posts.service.test.ts`.

**Interfaces:**

- `updatePost(postId: string, userId: string, dto: UpdatePostDto)` giữ kiểu response hiện tại.
- Sau commit, dùng pipeline `getPostById(postId, userId)` hoặc helper chung viewer-aware tương đương để trả response. Không chỉ ép flags true từ input và không thay default mapper cho khách.

- [ ] **Step 1: Viết red tests.** `update_response_preserves_viewer_marks` với liked/bookmarked/reposted true; `update_response_without_marks_remains_false`; `update_visibility_response_matches_authenticated_detail`. So response tương tác PATCH với GET, đồng thời assert không ghi/xóa marks.
- [ ] **Step 2: Chạy red.** `npm run test:posts -w backend`; cờ true hiện bị mapper đổi false phải làm test fail.
- [ ] **Step 3: Dùng mapping viewer-aware sau update.** Tái sử dụng luồng detail, giữ ownership check và transaction cập nhật visibility/replies. Không sửa frontend chỉ để che response sai; client hiện đã giữ flags khi merge edit.
- [ ] **Step 4: Chạy green.** `npm run test:posts -w backend`, `npm test -w frontend`, backend type-check. Kiểm tra private reply visibility và embedded quote vẫn được bảo vệ.
- [ ] **Step 5: Review diff riêng Task 5.** Khi đã có quyền commit: `fix(posts): retain viewer interactions in edit responses`.

## Cổng kiểm tra cuối khi thực thi

- [x] `npm test -w frontend` và `npm test -w backend` không fail.
- [x] `npm run build -w frontend` và backend `tsc --noEmit` pass; chạy `contract:emit` chỉ nếu chủ động kiểm tra contract generation hoặc schema thay đổi.
- [x] Browser cases mới của Tasks 1/3 và DB integration Tasks 2/4 đã chạy; ghi rõ capability/env và không thay fixture test bằng tuyên bố đã test thật.
- [x] Chạy lint thật, tránh Turbo cache khi báo kết quả mới. Không có lint error mới; tách baseline warnings ra khỏi regression và không gọi 536 warnings là sạch.
- [x] Probe audit phải được đánh dấu là bằng chứng lịch sử hoặc chuyển assertions sang hành vi đúng sau bản sửa; không để nó thành test yêu cầu duy trì bug.
- [x] Đọc lại diff với quyền truy cập, rollback transaction và các request đang chờ làm trọng tâm; không commit/push nếu chưa được yêu cầu.

## Tự rà soát plan

- [x] Cả F1–F5 đều có task, vị trí code, nguyên nhân và điều kiện kiểm chứng.
- [x] F5 có gate tái hiện PostgreSQL trước thay đổi hành vi.
- [x] Phân biệt bốn lỗi thực thi đã tái hiện với rủi ro predicate chưa kiểm chứng end-to-end.
- [x] Mỗi mục Review Focus có regression cases thuộc task sở hữu.
- [x] F2 và F1 nối tiếp để tránh sửa cùng auth protocol theo hai giả định khác nhau.
- [x] Không coi browser integration, DB concurrency hoặc sửa lỗi là đã hoàn thành chỉ vì unit baseline pass.
