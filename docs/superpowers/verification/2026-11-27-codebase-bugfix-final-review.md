# Review cuối bản sửa audit — 2026-11-27

## Kết luận và phạm vi

Đã hoàn tất review cả 5 task trong [implementation plan](../plans/2026-11-27-codebase-bugfix-plan.md), dựa trên [audit ban đầu](2026-11-27-codebase-audit.md). Không còn phát hiện Critical/Important chưa xử lý trong phạm vi review này. Chưa commit, push hoặc merge.

Đây là **self-review của người triển khai, không có subagent tool**, yếu hơn một reviewer độc lập. Kết luận không thay thế review độc lập trước merge và không khẳng định toàn bộ ứng dụng không còn lỗi.

Review bao phủ working-tree diff so với `762553fc284585dd3a6c94543bfd6a39a8a7c7fc` và các file mới không xuất hiện trong `git diff`: auth/posts PostgreSQL integration, browser auth helper, plan và tài liệu audit/probe. Không có commit range bất biến; các kết quả áp dụng cho nội dung đã kiểm tra ở thời điểm bàn giao trên `feat/frontend-theme-layout`.

## Đối chiếu Review Focus

1. **Đổi tài khoản/logout:** lifecycle message vô hiệu token và epoch trước callback UI, hủy request cũ, tháo shell/draft/socket; không replay mutation bằng danh tính mới. Browser kiểm tra React, BroadcastChannel và Socket.IO thật với REST fixture.
2. **OTP đồng thời:** claim SQL tăng attempts có điều kiện hạn dùng/giới hạn; chỉ request claim thành công mới so mã. Transaction consume có điều kiện trước cập nhật user/session, rollback khi consume thất bại. PostgreSQL kiểm tra cả đăng ký và reset password, attempts=4, hết hạn và single-use.
3. **Refresh nhiều tab:** loại token bị từ chối/hết hạn, Web Locks serialize rotation, kiểm tra epoch trước/sau chờ; tối đa một replay và giữ idempotency key. Thiếu coordination có fallback hữu hạn, có thể yêu cầu đăng nhập lại.
4. **Tombstone:** direct reply count gồm retained tombstone. Cleanup kiểm tra quan hệ parent/root sau row lock. Purge chỉ DELETE tập ID đã khóa, tránh tombstone mới xuất hiện giữa hai statement. Integration kiểm tra cây sâu, counter sai, quyền root và concurrent insert; không đổi schema/FK.
5. **Response sửa bài:** dùng lại `getPostById(postId, userId)` sau update, so PATCH response với authenticated detail và không thay viewer marks.

## Phát hiện và xử lý trong final fix pass

### Important: mất AbortError khi hủy request trong lúc refresh

- Vị trí: `frontend/src/api.ts`, nhánh request nhận 401 rồi chờ shared refresh.
- Nguyên nhân: controller đã bị hủy khiến code bỏ qua replay, nhưng vẫn đọc response 401 ban đầu và trả `ApiError`.
- RED: test `aborting a request during refresh rejects with AbortError and never replays its write` thất bại với actual `ApiError`, expected `AbortError`.
- Sửa tối thiểu: `signal?.throwIfAborted()` sau khi lấy access token thay thế, trước nhánh đọc response hoặc replay.
- GREEN: regression pass; chỉ gửi mutation ban đầu một lần, shared refresh vẫn giữ token mới. Toàn suite sau fix pass: frontend 64/64, backend 179/179.

### Gate lint/format

Biome toàn repo phát hiện 6 errors ở phần thay đổi: 3 nhóm import chưa sắp xếp, 2 tài liệu Markdown chưa format, 1 callback forEach trả biểu thức. Đã sửa đúng các vị trí đó và chạy lại root lint với Turbo cache bị vô hiệu. Không thay lint rules hoặc cleanup warnings hàng loạt.

Không có phát hiện Critical. Danh sách hành vi bị reviewer từ chối đánh giá (Declined to judge): không có.

## Verification sau lần sửa cuối

| Gate                                                                                          | Kết quả                                                                                                       |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm test -- --force`                                                                         | Frontend 64/64; backend 179/179; 2 tasks successful, 0 cached                                                 |
| `npm run build -w frontend`                                                                   | Pass, gồm frontend tsc và Vite production build                                                               |
| `npm exec -w backend -- tsc --noEmit`                                                         | Pass                                                                                                          |
| `NODE_ENV=test AUTH_TEST_DATABASE_URL=… npm run test:auth:integration -w backend`             | 8 cases pass trên PostgreSQL loopback disposable                                                              |
| `NODE_ENV=test POSTS_TEST_DATABASE_URL=… npm run test:posts:retention:integration -w backend` | 7/7 pass trên cùng DB test, chạy sau auth                                                                     |
| `npm run test:browser -w frontend`                                                            | Pass cold tabs, concurrent 401, fallback và peer draft/socket teardown; inbox regressions cũng pass           |
| `npm run lint -- --force`                                                                     | Exit 0; Biome 0 errors, 753 warnings, 9 infos; ESLint backend 0 errors, 536 warnings; frontend pass; 0 cached |
| `git diff --check`                                                                            | Pass                                                                                                          |

ESLint backend chạy trực tiếp cũng xác nhận 113 files, 0 errors, 536 warnings, bằng số warnings của baseline. **Không gọi lint sạch.** Node có cảnh báo DEP0205 từ SWC register; không có test failure.

Browser auth dùng REST/refresh-cookie fixtures cùng BroadcastChannel, Web Locks, React và Socket.IO thật trên Chromium; không phải auth E2E với backend HTTP thật hoặc chứng nhận mọi trình duyệt. PostgreSQL integration gọi service/repository thật. Không chạy upload Cloudinary thật, không chạy repair trên dữ liệu người dùng, không chạy lại contract generation vì không đổi contract/schema.

Probe audit chỉ là bằng chứng lịch sử tại `762553f`, không dùng làm regression gate hiện tại. Runbook giải thích rằng liên kết đã mất do SET NULL không tự khôi phục được nếu thiếu backup/audit trail.

## Rulings I made

Theo đúng thứ tự ledger, bao gồm các quyết định từ những lượt thực thi trước:

1. Sandbox ban đầu chặn git dù đã được đồng ý: thực thi trong feature checkout hiện có, không tạo worktree/commit. Chi phí nếu sai: có thể lẫn thay đổi cục bộ và thiếu commit bookkeeping.
2. Tiếp tục checkout hiện có, giữ các thay đổi Task 1/2 chưa commit và không commit/push: tránh mất công việc đã được cho phép tiếp tục. Chi phí nếu sai: thiếu isolation và commit review ranges.
3. Dùng audit report truy cập được làm spec, diễn giải qua implementation plan. Chi phí nếu sai: chính sách đổi tài khoản giữa tab cần được điều chỉnh trước merge.
4. Tạo PostgreSQL disposable loopback tại port 55487, chỉ migrate DB mới `mxh_audit_test`. Chi phí nếu sai: cần cleanup hạ tầng test rõ ràng; không sử dụng DB thật.
5. Fixture auth chỉ có ORM bỏ qua raw claim SQL; xác minh SQL/concurrency riêng trên PostgreSQL. Chi phí nếu sai: unit fixtures không phát hiện SQL hỏng, cần gate DB integration.
6. Khi git truy cập lại được, vẫn tiếp tục in-place và không commit/push theo phạm vi đã thống nhất. Chi phí nếu sai: thiếu commit range riêng và review context độc lập.
7. Dùng PostgreSQL regressions tập trung cho quan hệ/locking thay vì lặp lại bằng ORM predicate mocks. Chi phí nếu sai: CI chỉ chạy unit không bắt được SQL regression; cần integration gate riêng.
8. Review full working-tree diff cùng danh sách file mới thay commit-only review-package vốn từ chối range rỗng, vì chưa có quyền commit. Chi phí nếu sai: review không có commit boundary bất biến.

## Deferred minors

- `backend/src/scripts/purge-retention.ts`: purge khóa toàn bộ tombstone và truyền danh sách ID trong một transaction. Có thể tăng thời gian giữ lock/kích thước payload khi dữ liệu lớn; chưa benchmark hoặc bổ sung batching.
- `frontend/checks/auth-browser.mjs`: fixture fallback dùng delay 30 ms và yêu cầu đúng một tab mất phiên; chưa có barrier bảo đảm hai request cùng cookie trước rotation. Có nguy cơ false failure do scheduling trên máy CI chậm; nên đồng bộ fixture bằng barrier khi cần cải thiện độ ổn định.

## Bàn giao

Giữ branch `feat/frontend-theme-layout` và toàn bộ thay đổi chưa commit. PostgreSQL disposable và các tiến trình Vite do phiên audit tạo đã được dừng sau verification; dữ liệu test vẫn được giữ. Ledger/log ở `.superpowers/sdd/2026-11-27-codebase-bugfix-plan/`; không xóa workspace vì chưa có commit lưu bằng chứng. Các bước commit trong plan vẫn chờ yêu cầu riêng. Hai deferred minors ở trên chưa được sửa và không chặn kết luận trong phạm vi review này.
