# Messenger Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gửi tối đa 5 ảnh công khai trong một tin nhắn, có caption, tiến trình, retry và xem ảnh lớn.

**Architecture:** Upload trực tiếp Cloudinary, backend xác minh ảnh trước khi lưu Message/MessageMedia trong transaction. Mở rộng inbox hiện tại; ảnh không được gửi được dọn bằng script có dry-run và cơ chế đồng bộ với thao tác gắn ảnh.

**Tech Stack:** React 19, TypeScript, Vite, XMLHttpRequest, NestJS 12, Socket.IO, PostgreSQL, Prisma 8 RC, Cloudinary SDK.

**Spec:** `docs/superpowers/specs/2026-11-26-messenger-images-typing-design.md`

## Trạng thái nghiệm thu 2026-11-26

Tasks 1–5 đã triển khai và nghiệm thu cục bộ, gồm upload Cloudinary thật 1/5 ảnh và retry sau mất phản hồi commit. `npm test`, `npm run lint`, `npm run build`, browser fixtures và DB/live integration đều đạt. Lint còn cảnh báo cũ. Các bước commit chưa thực hiện: giữ worktree chưa commit theo quyết định bàn giao hiện có. Checklist dưới đây là trình tự triển khai gốc; kết quả và giới hạn hiện tại nằm trong [báo cáo nghiệm thu](../verification/2026-11-26-messenger-acceptance.md).

## Global Constraints

- Tối đa 5 ảnh mỗi tin; mỗi ảnh <= 10 * 1024 * 1024 bytes; JPEG, PNG, WebP, GIF.
- URL công khai; caption tùy chọn; văn bản tối đa 2000 ký tự như hiện tại.
- Giữ luồng text, cursor pagination, read/unread, retry deduplication và session refresh.
- Network I/O nằm ngoài DB transaction; migration mới, không sửa migration đã có.
- Frontend không import backend; không thêm thư viện UI/state mới.
- Copy giao diện tiếng Việt; dùng style inbox hiện tại.

## Review Focus

- Client giả bytes/MIME: metadata Cloudinary thật quyết định chấp nhận, không tin metadata client (Task 1).
- HTTP timeout sau commit: retry trả lại đúng một tin có đầy đủ ảnh và không emit thêm (Task 2).
- Dọn ảnh chạy đồng thời gửi: không xóa ảnh đã được gắn hoặc lưu tin trỏ đến ảnh đang xóa (Task 4).
- Người dùng đổi danh sách ảnh sau lỗi: ID gửi mới, còn retry cùng payload giữ ID (Task 3).
- Ảnh tải muộn và viewer trên mobile: không kéo người đang đọc lịch sử xuống cuối; keyboard/focus hoạt động (Task 5).

## Bản đồ file và trách nhiệm

- Backend media: `backend/src/media/media.service.ts`, tests: ký upload và đọc metadata Cloudinary bằng API công khai của module.
- Backend messaging: controller/service/repository/module và DTO hiện có; file mới `dto/message-media.dto.ts`, `message-media.service.ts`, `message-media.service.test.ts`: quy tắc xác minh ảnh chat.
- DB: `backend/src/prisma/contract.prisma`, generated contract, migration mới: MessageMedia và trạng thái cleanup.
- Frontend: `frontend/src/inbox/media.ts`, `use-message-media.ts`, `message-media.tsx`: validation/upload, vòng đời upload, preview/viewer; thread/model/data/index/css hiện có tích hợp.
- Cleanup: `backend/src/scripts/purge-message-media.ts`, test đi kèm, script package và runbook.
- Kiểm chứng: messaging unit/integration, `frontend/checks/inbox-media.test.ts`, `frontend/checks/live.test.mjs`.

### Task 1: Xác minh và cấp upload ảnh chat

**Files:** Modify `backend/src/media/media.service.ts`, `backend/src/media/media.service.test.ts`, `backend/src/messaging/messaging.controller.ts`, `backend/src/messaging/messaging.module.ts`; create `backend/src/messaging/message-media.service.ts`, `backend/src/messaging/message-media.service.test.ts`, `backend/src/messaging/dto/message-media.dto.ts`.

**Interfaces:**

- `MessageMediaInput = {publicId: string; version: number; signature: string}`.
- `VerifiedMessageMedia = {publicId: string; url: string; width: number; height: number; format: string; bytes: number; order: number}`.
- `MessageMediaService.verify(userId: string, items: MessageMediaInput[]): Promise<VerifiedMessageMedia[]>`.
- `POST /conversations/:id/media/upload-signature` trả cùng trường chữ ký hiện tại, folder `mxh/{userId}/messages`; kiểm tra thành viên trước khi cấp, chỉ ký ảnh.
- `MediaService.getImageMetadata(publicId: string)` gọi Cloudinary resource API với resource_type=image, type=upload; expose dữ liệu đã narrow, không lộ SDK vào MessagingService.

- [ ] Viết tests: 5 ảnh hợp lệ giữ thứ tự; 6 ảnh bị từ chối; bytes=10485760 hợp lệ và 10485761 bị từ chối; format ngoài jpeg/jpg/png/webp/gif, resource video, prefix người khác, chữ ký sai, publicId trùng, version không khớp đều bị từ chối; metadata client không quyết định kết quả.
- [ ] Chạy `npm run test:messaging -w backend` và `npm run test:media -w backend`; xác nhận test mới fail vì thiếu interface.
- [ ] Thêm DTO nested validation và verifier; backend dựng URL chuẩn từ metadata đã xác minh. Endpoint xin chữ ký dùng auth, membership và throttle hiện có. Giữ verifier posts không thay đổi semantics.
- [ ] Chạy lại hai suite; kỳ vọng PASS, tests posts/profile media hiện có vẫn pass.
- [ ] Commit phần cấp quyền upload/xác minh với Conventional Commit sau khi kiểm tra diff.

### Task 2: Lưu và đọc tin có nhóm ảnh

**Files:** Modify `backend/src/prisma/contract.prisma`, generated contracts, migration mới; `backend/src/messaging/dto/send-message.dto.ts`, `dto/messaging-response.dto.ts`, `messaging.repository.ts`, `messaging.service.ts`, `messaging.service.test.ts`, `messaging.integration.ts`.

**Interfaces:**

- Input gửi `{clientMessageId: string; body?: string; media?: MessageMediaInput[]}`.
- Response media `{id, publicId, url, width, height, format, bytes, order}[]`; `type: "TEXT" | "IMAGE"`, body giữ semantics tombstone null; ảnh-only dùng body="".
- `MessagingRepository.createMessage({conversationId, senderId, clientMessageId, body, media: VerifiedMessageMedia[]})` trả `{message, created}` gồm media.
- `findMediaForMessages(messageIds: string[])` trả map id → media có thứ tự; dùng chung cho history và lastMessage.

- [ ] Viết tests text không đổi; image-only; caption + 5 ảnh; body rỗng + media rỗng lỗi; caption >2000 lỗi; outsider lỗi; retry cùng ID trả lại media và không emit thêm. Test lịch sử và danh sách hội thoại trả đủ ảnh có thứ tự.
- [ ] Chạy `npm run test:messaging -w backend`, xác nhận fail đúng yêu cầu mới.
- [ ] Thêm IMAGE, MessageMedia với unique publicId và unique(messageId, order), relation cascade, metadata và index messageId. Giữ body DB không nullable. Tạo migration roll-forward bằng CLI Prisma 8 đang cài (đọc `--help` trước; không dùng lệnh migrate của Prisma phiên bản khác), rồi `npm run contract:emit -w backend`.
- [ ] Tích hợp verifier Task 1 trước transaction; retry lookup trước external I/O. Lưu message/media/update conversation atomically, truy vấn theo lô cho mọi read path và retry path, phát sự kiện một lần sau commit. Tombstone không trả media.
- [ ] Chạy unit suite; áp dụng migration chỉ vào DB thử nghiệm cục bộ rồi `npm run test:messaging:integration -w backend` với `MESSAGING_TEST_DATABASE_URL` trỏ DB đó. Kỳ vọng PASS cả ảnh, text, pagination, quyền và deduplication; mock Cloudinary ở test xác minh metadata, ghi rõ upload thật chưa được chứng minh.
- [ ] Commit migration, generated contracts và tính năng persistence cùng nhau.

### Task 3: Soạn, upload và gửi nhóm ảnh

**Files:** Create `frontend/src/inbox/media.ts`, `frontend/src/inbox/use-message-media.ts`, `frontend/checks/inbox-media.test.ts`; modify `frontend/src/inbox/model.ts`, `data.ts`, `thread.tsx`, `inbox.css`, `frontend/checks/inbox.test.ts`.

**Interfaces:**

- `MessageMediaInput` và response types mirror contract Task 2, khai báo cục bộ frontend.
- `validateMessageImages(files: File[], existingCount: number): string | null` kiểm tra toàn batch; không nhận quá 5 ảnh/10485760 bytes hoặc MIME ngoài allowlist.
- `uploadMessageImage(conversationId: string, file: File, signal: AbortSignal, onProgress: (percent: number) => void): Promise<MessageMediaInput>` xin chữ ký REST và XHR đến Cloudinary.
- `useMessageMedia(conversationId)` expose `items, add(files), remove(id), retry(id), uploadAll(), clear(), busy`; mỗi item giữ file, object URL và trạng thái queued/uploading/ready/error.
- `MessageDraft = {body: string; clientMessageId: string; media?: MessageMediaInput[]}`; `messageDraft` so sánh body + ordered publicId/version/signature để giữ/tạo ID.

- [ ] Viết unit tests giới hạn 5/6, bytes đúng/vượt, loại file, order, retry giữ ID, thay ảnh/order tạo ID; mock XHR kiểm tra progress/abort/non-2xx và giữ upload thành công khi một ảnh khác lỗi.
- [ ] Chạy `npm test -w frontend`; xác nhận tests mới fail.
- [ ] Thực hiện upload/hook; thêm picker multiple, preview/remove/progress/retry; vô hiệu gửi khi không có text/ảnh hoặc đang upload; submit uploadAll rồi POST một tin. Không gửi một phần nhóm khi một ảnh lỗi. Khóa snapshot trong submit; lỗi giữ draft/media, thành công clear và revoke object URLs; rời trang abort/revoke. Chỉ text được phục hồi từ sessionStorage.
- [ ] Chạy `npm test -w frontend` và `npm run build -w frontend`; kỳ vọng PASS. Kiểm tra trường hợp server commit nhưng client timeout bằng fixture API và xác nhận lần retry cùng ID.
- [ ] Commit phần composer/upload.

### Task 4: Dọn ảnh chat mồ côi an toàn

**Files:** Create `backend/src/scripts/purge-message-media.ts`, `purge-message-media.test.ts`; modify contract/migration mới, `backend/src/messaging/message-media.service.ts`, `messaging.repository.ts`, `backend/src/media/media.service.ts`, `backend/package.json`, `docs/05-runbook-deploy.md`.

**Interfaces:**

- Model `MessageMediaDeletion` có publicId unique, status=PENDING|DELETED, createdAt; dùng làm reservation trước external delete.
- `executePurgeMessageMedia({dryRun: boolean, before: Temporal.Instant}): Promise<{candidates: number; deleted: number; failed: number}>`.
- Script `purge:message-media` mặc định dry-run; `--apply` mới xóa; ngưỡng mặc định >24 giờ.
- Send và cleanup dùng cùng PostgreSQL advisory transaction lock theo publicId; với nhiều ảnh lấy khóa theo publicId đã sort để tránh deadlock.

- [ ] Viết tests asset mới bỏ qua, ảnh đã gắn bỏ qua, prefix posts/avatars không đụng, phân trang inventory, dry-run không xóa; cleanup/send cạnh tranh chỉ một phía nhận quyền; external delete lỗi giữ PENDING và retry được.
- [ ] Chạy test mới trực tiếp bằng `node --import @swc-node/register/esm-register --test src/scripts/purge-message-media.test.ts` trong backend, xác nhận fail.
- [ ] Thêm migration/model và script. Cleanup lấy khóa + kiểm tra MessageMedia + reserve PENDING rồi commit trước gọi Cloudinary. Send trong transaction dưới cùng khóa từ chối mọi reservation. Chỉ xóa asset không có reference; không giữ transaction trong network I/O. Retry PENDING sau lỗi, ngừng cấp lại một asset đã được reserve. Liệt kê inventory qua MediaService, không gọi SDK trong messaging/repository.
- [ ] Chạy tests unit và integration concurrency trên DB thử nghiệm. Cập nhật test:retention để bao gồm suite mới và runbook với cron hàng ngày, dry-run, apply, retry; không cài cron vào máy người dùng trong task.
- [ ] Commit cleanup và hướng dẫn vận hành.

### Task 5: Hiển thị ảnh, viewer và nghiệm thu

**Files:** Create `frontend/src/inbox/message-media.tsx`; modify `thread.tsx`, `index.tsx`, `inbox.css`, `frontend/checks/live.test.mjs`, `frontend/checks/browser.test.mjs`, `frontend/README.md`.

**Interfaces:** `MessageMedia({items: MessageMedia[]})` hiển thị grid/viewer; `messagePreview(message, userId)` trong model trả caption hoặc “Đã gửi N ảnh” kèm prefix “Bạn: ”; không lộ ảnh tombstone.

- [ ] Thêm browser assertions grid 1/5 ảnh, viewer chuyển ảnh/đóng Escape/trả focus, preview caption/ảnh-only, ảnh lỗi; ảnh load muộn khi người dùng đọc lịch sử không kéo xuống cuối. Kiểm tra desktop và viewport 390px không tràn ngang.
- [ ] Chạy browser check để thấy thiếu UI; triển khai component và tích hợp preview. Giữ kích thước theo width/height, lazy-load lịch sử và xử lý image load errors bằng copy tiếng Việt.
- [ ] Chạy `npm test`, `npm run lint`, `npm run build` tại root. Chạy `npm run test:browser -w frontend` với môi trường theo hướng dẫn hiện có.
- [ ] Chạy `npm run test:live -w frontend` với `MXH_LIVE_TEST_URL` trỏ deployment/database thử nghiệm cục bộ; hai tài khoản gửi/nhận nhóm ảnh và retry. Chạy riêng upload thật bằng Cloudinary thử nghiệm khi có cấu hình; nếu thiếu, báo rõ bước chưa được xác minh, không thay bằng tuyên bố mock đã chứng minh upload thật.
- [ ] Review diff/kiến trúc/migration và commit phần UI/nghiệm thu. Ghi kết quả lệnh, giới hạn còn lại trước bàn giao.
