# Rà soát codebase MXH — 2026-11-27

## Phạm vi và trạng thái

> Bằng chứng lịch sử trước sửa tại `762553f`. Trạng thái triển khai và kiểm tra sau sửa nằm trong [báo cáo review cuối](2026-11-27-codebase-bugfix-final-review.md); các kết quả bên dưới mô tả lượt audit ban đầu.

Yêu cầu: đọc codebase, tìm lỗi, lập kế hoạch sửa. Chưa sửa mã ứng dụng, chưa commit, chưa chạy migration/seed/purge trên dữ liệu thật.

Đã đọc bộ docs 01–05, README root/backend/frontend; lần theo auth/session phía client và server, posts/repository/mapper/schema, messaging service/repository và các hook dữ liệu inbox. Đây là một vòng rà soát tập trung vào tính đúng đắn và quyền truy cập, không phải xác nhận toàn bộ ứng dụng không còn lỗi.

- [x] Đọc quy ước và đối chiếu kiến trúc hiện tại.
- [x] Chạy baseline unit/transport tests và type-check.
- [x] Lần theo nguyên nhân, tạo probe tái hiện các phát hiện.
- [x] Phân biệt bằng chứng thực thi và rủi ro mới xác nhận qua truy vấn.
- [x] Viết kế hoạch sửa với test và tiêu chí nghiệm thu.
- [ ] Thực hiện các bản sửa và regression tests — ngoài phạm vi lượt audit.

## Bằng chứng đã chạy

| Lệnh                                                                                           | Kết quả                                                                                           |
| ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `npm test -w frontend`                                                                         | 56/56 pass                                                                                        |
| `npm test -w backend`                                                                          | 174/174 pass, gồm Socket.IO transport fixture; không phải integration PostgreSQL                  |
| `npm exec -w frontend -- tsc --noEmit`                                                         | Exit 0                                                                                            |
| `npm exec -w backend -- tsc --noEmit`                                                          | Exit 0; chưa chạy lại `contract:emit`                                                             |
| `npm run build -w frontend`                                                                    | Vite production build thành công                                                                  |
| `npm run lint`                                                                                 | Exit 0; Turbo replay cache, backend báo 0 errors và 536 warnings; không coi là lint sạch          |
| `npm exec -w backend -- eslint --format json --output-file /tmp/mxh-audit-backend-eslint.json` | Chạy lại trực tiếp, không dùng Turbo cache: 111 files, 0 errors, 536 warnings; thống kê bằng `jq` |
| `npm exec -- biome check docs/superpowers/verification/2026-11-27-codebase-audit-repro.mjs`    | Pass sau khi format đúng quy ước                                                                  |
| Probe bên dưới                                                                                 | F1–F4 tái hiện bằng code ứng dụng với boundary fixtures; F5 xác nhận predicate truy vấn           |

Chạy probe từ root:

```sh
cd backend && node --import @swc-node/register/esm-register ../docs/superpowers/verification/2026-11-27-codebase-audit-repro.mjs
```

Cần cwd `backend` để SWC đọc tsconfig có decorator. Probe không truy cập mạng, DB, SMTP hoặc Cloudinary. Assertions cố ý xác nhận **hành vi lỗi hiện tại**; probe pass không có nghĩa lỗi đã sửa. Khi triển khai, viết regression tests theo hành vi đúng trong test suite tương ứng.

## F2 — P1: Token đổi tài khoản giữa các tab nhưng giao diện vẫn giữ tài khoản cũ

**Vị trí:** `frontend/src/api.ts:112–136`, `frontend/src/app.tsx:74–97,170–192`.

`adoptPeerToken()` nhận mọi broadcast token rồi thay token trong client. Client không thông báo thay đổi danh tính cho `App`; `App` giữ `session.user`, component state và socket gắn theo user ID cũ. `setToken(null)` không broadcast logout.

**Tái hiện:** tạo hai client với bus mô phỏng BroadcastChannel, loại trừ sender; A đặt token tài khoản A; B đặt token tài khoản B; A gửi POST. Authorization thực tế là `Bearer account-B`. B clear token thì A vẫn giữ token B. Probe xác nhận tầng client; trạng thái UI/socket được xác định từ luồng `App`, chưa chạy browser E2E cho ca này.

**Tác động:** một draft đang mở dưới tên A có thể được gửi với danh tính B sau thao tác đổi tài khoản ở tab khác. Logout cũng không đồng bộ chủ động. Không kết luận đây là vượt quyền giữa hai trình duyệt hay hai người dùng độc lập.

**Hướng sửa đề xuất:** chính sách một tài khoản chung cho các tab cùng origin, phù hợp refresh cookie đang dùng chung. Phân biệt refresh cùng phiên với login/logout/đổi tài khoản; sự kiện đổi phiên phải chặn các mutation đang chờ, xóa state riêng tư, xác thực lại `/auth/me`, rồi dựng lại shell/socket theo danh tính đã xác nhận. Không replay mutation cũ sang tài khoản mới. Đây là quyết định đề xuất, chưa phải chính sách đã được người dùng phê duyệt.

## F3 — P1: Giới hạn 5 lần OTP bị mất lượt tăng khi request đồng thời

**Vị trí:** `backend/src/auth/auth.service.ts:119–139,440–461`; `backend/src/users/users-auth.service.ts:78–80`; `backend/src/users/users.repository.ts:80–84`.

Cả verify đăng ký và reset password đọc `attempts`, kiểm tra `< 5`, rồi ghi đè `attempts + 1` từ snapshot JavaScript. Nhiều request cùng đọc một giá trị sẽ ghi cùng một số, thay vì tăng nguyên tử.

**Tái hiện:** với mỗi flow, 5 request nhập sai chạy qua `Promise.allSettled`; cả 5 bị từ chối nhưng `attempts` cuối cùng chỉ là 1. Fixture cho phép mỗi request đọc snapshot riêng, giống read-before-write hiện tại; chưa phải concurrency test trên PostgreSQL.

**Tác động:** có thể thử nhiều hơn 5 mã cho cùng OTP. Throttling HTTP hiện có vẫn áp dụng, nhưng không khôi phục bảo đảm 5 lần trên từng OTP.

**Hướng sửa:** claim lượt thử nguyên tử theo ID, hạn dùng và `attempts < 5`, trả kết quả claim từ repository trong transaction. Chỉ request claim được lượt mới được so mã và tiếp tục nghiệp vụ. Kiểm tra và consume OTP thành công cũng cần cùng bảo đảm single-use; đây là ca bổ sung phải kiểm chứng, không phải lỗi single-use đã được xác nhận trong audit.

## F1 — P1: Nhiều tab có thể giữ token đã bị từ chối và không gọi HTTP refresh

**Vị trí:** `frontend/src/api.ts:119–121,139–179,208–213`.

Tab trả lời `request-token` với bất kỳ token đang giữ, không xét token đã bị server từ chối, thời hạn, hoặc mục đích refresh. `refresh()` trả ngay khi nhận peer token, kể cả đó là chính token vừa gây 401.

**Tái hiện:** hai client cùng giữ `expired`; endpoint riêng tư trả 401; endpoint refresh fixture có thể cấp token mới. `request('/private')` vẫn lỗi 401 và số lần gọi `/auth/refresh` bằng 0. Cả hai tab có thể lặp lại tình trạng này.

**Tác động:** mất khả năng phục hồi phiên khi token hết hạn hoặc bị từ chối, dù refresh cookie có thể còn hợp lệ. Probe không khẳng định refresh cookie thật hợp lệ vì HTTP được fixture.

**Hướng sửa:** không trả hoặc nhận lại token đã bị từ chối; phân biệt hỏi token lúc bootstrap và phục hồi sau 401; kiểm tra `exp` như bộ lọc phía client, server vẫn là nguồn xác thực. Cần serialize refresh giữa các tab, vì single-flight hiện tại chỉ áp dụng trong một client. Với tab lạnh đồng thời hoặc BroadcastChannel không có, phải có fallback được kiểm thử và không tuyên bố hỗ trợ khi chưa nghiệm thu.

## F5 — P1, cần integration xác nhận: Reconcile và cleanup dùng hai ý nghĩa khác nhau của replyCount

**Vị trí:** `backend/src/posts/posts.repository.ts:529–595,649–695,796–814`; `backend/src/scripts/purge-retention.ts:39–45`; `backend/src/prisma/contract.prisma:117–123`.

- Delete giữ tombstone nếu còn **bất kỳ** reply row nào, bao gồm reply đã xóa có descendants.
- Hai hàm count quan hệ lại loại `isDeleted = true` khỏi số reply.
- Reconciler có thể ghi `replyCount = 0` lên một root còn sống nhưng chỉ có con là tombstone.
- Khi root này bị xóa, delete giữ root tombstone do vẫn có reply row, nhưng không sửa lại `replyCount`.
- Purge chỉ nhìn `isDeleted = true AND replyCount = 0`, không kiểm tra quan hệ thật. `cleanupParentTombstone()` cũng quyết định xóa dựa vào counter.
- Foreign key `parentId` và `rootId` dùng `onDelete: SetNull`.

**Chuỗi cần kiểm chứng bằng DB riêng:** root R → reply A → reply B còn sống; xóa A; reconcile khi R còn sống; xóa R; purge. Theo predicate hiện tại, R có thể bị hard-delete dù B còn sống, làm `rootId` của descendants thành null và phá ngữ cảnh quyền của thread. Với root FOLLOWERS và tác giả B khác root author, cần thử viewer chỉ follow B để xác định hậu quả phân quyền thực tế.

**Mức bằng chứng:** đã compile query counter bằng ORM thật với fake driver và kiểm tra SQL purge thật, xác nhận các predicate không tương thích. Chưa chạy toàn chuỗi trên PostgreSQL; chưa tuyên bố đã quan sát rò rỉ nội dung hoặc mất dữ liệu thật.

**Hướng sửa:** trước tiên viết integration red case. Giữ `replyCount` là số direct reply row còn giữ trong cây, gồm tombstone cần cho descendants, để phù hợp logic delete và liên kết xem hội thoại. Cleanup/purge phải kiểm tra quan hệ tồn tại trong transaction thay vì tin counter; kiểm tra cả tham chiếu root để bảo vệ dữ liệu cũ. Bổ sung đối soát cho tombstone đang giữ, không chỉ active posts. Không thay chính sách FK hoặc sửa migration cũ để che triệu chứng.

## F4 — P2: Response sửa bài trả sai trạng thái like/bookmark/repost của người sửa

**Vị trí:** `backend/src/posts/posts.service.ts:153–191`; `backend/src/posts/dto/post-response.dto.ts:154–156`.

`getPostById()` đọc viewer marks, còn `updatePost()` gọi mapper không có sets. Mapper mặc định tất cả tương tác là false.

**Tái hiện:** chủ bài đã like và bookmark; GET trả hai cờ true; PATCH nội dung trả hai cờ false, không có lệnh xóa marks nào.

**Tác động:** API trả state sai và khác GET. Frontend hiện chỉ merge content/visibility/editedAt khi edit (`frontend/src/social/model.ts:230–233`), nên chưa có bằng chứng nút like trên UI hiện tại bị reset do lỗi này. Không gán thêm tác động UI chưa chứng minh.

**Hướng sửa:** response update dùng lại pipeline viewer-aware của detail, giữ nguyên DTO và response semantics; regression test so PATCH với GET cho cùng user và cùng bài.

## Điểm bổ sung và giới hạn

- `docs/01-architecture.md` và một số phần backend/runbook còn mô tả Next.js, trong khi `docs/03-frontend-ui.md` và source hiện dùng React/Vite; docs frontend đã giải thích đây là sơ đồ lịch sử. Không tính sự khác biệt này là runtime bug.
- 536 backend lint warnings là nợ chất lượng, không phải 536 lỗi nghiệp vụ. Chưa rà soát từng warning hoặc đổi rules.
- Đọc và chạy test messaging hiện có chưa phát hiện thêm lỗi có đủ bằng chứng để đưa vào danh sách sửa chính.
- Chưa chạy browser E2E, integration PostgreSQL hoặc upload Cloudinary thật trong lượt này. Không tự dùng DB/cloud được cấu hình sẵn để tạo hoặc xóa dữ liệu.
- Git status/log bị bash-guard chặn; không xác định workspace có sạch hay không và không kiểm tra được recent commits. Không có commit trong lượt này.

## Quyết định cho plan

Ưu tiên F2 → F3 → F1 → F5 → F4. F2/F1 dùng cùng client, thực hiện nối tiếp. Mỗi lỗi có regression red trước, bản sửa nhỏ và kiểm tra lại suite liên quan; không gộp refactor hoặc nâng dependency. Với F5, cần môi trường DB test riêng trước khi chuyển từ giả thuyết truy vấn sang bản sửa hành vi.

Plan: [2026-11-27-codebase-bugfix-plan.md](../plans/2026-11-27-codebase-bugfix-plan.md).
