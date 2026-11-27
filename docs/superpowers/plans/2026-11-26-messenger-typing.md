# Messenger Typing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hiển thị đối phương đang nhập trong chat 1–1, tự hết hạn và hoạt động đúng khi có nhiều tab.

**Architecture:** Một gateway thuộc MessagingModule nhận sự kiện qua socket hiện có, kiểm tra membership và chuyển đến user room của đối phương. Client giữ trạng thái tạm theo stream/tab; không ghi DB, không reload dữ liệu do typing.

**Tech Stack:** NestJS 12, Socket.IO 4, React 19, TypeScript, Vite, node:test và Playwright.

**Spec:** `docs/superpowers/specs/2026-11-26-messenger-images-typing-design.md`

## Trạng thái nghiệm thu 2026-11-26

Tasks 1–3 đã triển khai; unit, transport, DB integration và live Chromium hai tài khoản đều đạt, gồm hai tab dùng chung cookie. Root test/lint/build đạt; lint còn cảnh báo cũ. Chưa commit/merge/push theo quyết định giữ worktree hiện có. Checklist dưới đây là trình tự triển khai gốc; xem [báo cáo nghiệm thu](../verification/2026-11-26-messenger-acceptance.md) để biết bằng chứng và giới hạn.

## Global Constraints

- Tối đa một tín hiệu đang nhập mỗi 2 giây; tự ẩn sau 4 giây không nhận thêm tín hiệu.
- Copy “Tên người dùng đang nhập…” dưới tên đối phương trong cuộc trò chuyện.
- Gửi/xóa hết nội dung/rời cuộc trò chuyện phải phát dừng; chọn ảnh/upload không phát đang nhập.
- Dùng socket do app sở hữu; không tạo kết nối thứ hai; không queue tín hiệu cũ sau reconnect.
- Định danh từ socket đã xác thực, kiểm tra thành viên; chỉ đối phương nhận; không lưu DB, không tăng unread.
- Dùng style inbox hiện tại; không đổi kiến trúc frontend hoặc thêm thư viện.

## Review Focus

- Socket chưa xác thực hoặc phiên bị thu hồi: không được chuyển tín hiệu (Task 1).
- Spam bắt đầu/đổi conversation và payload giả userId: rate limit tổng socket và membership, không tin recipient đầu vào (Task 1).
- Hai tab cùng gõ, một tab dừng: indicator còn đến khi tab cuối dừng/hết hạn (Task 2).
- Mất mạng khi đang gõ: tự xóa trạng thái, không buffer start/stop để replay sau reconnect (Task 2).
- Realtime typing làm tăng request/unread hoặc đổi thread bị nháy trạng thái: xử lý riêng và hủy timer/listener (Task 3).

## Bản đồ file

- `backend/src/messaging/messaging-typing.gateway.ts` + test: handler, auth/membership, limits, relay.
- `backend/src/messaging/dto/typing.dto.ts`: payload validation.
- `backend/src/messaging/messaging.service.ts`, module: public method kiểm tra người nhận, đăng ký gateway.
- `backend/src/events/event-types.ts`: event name/payload.
- `frontend/src/realtime.ts`, `app.tsx`: emitter tạm dùng socket hiện có và thông báo disconnect.
- `frontend/src/inbox/typing.ts`, `use-typing.ts`: bộ điều khiển thời gian và React lifecycle.
- `frontend/src/inbox/thread.tsx`, `inbox.css`: tích hợp nội dung input và indicator.
- `frontend/checks/typing.test.ts`, backend messaging integration, frontend live checks: kiểm chứng.

### Task 1: Gateway typing có kiểm tra quyền

**Files:** Create `backend/src/messaging/messaging-typing.gateway.ts`, `messaging-typing.gateway.test.ts`, `dto/typing.dto.ts`; modify `messaging.service.ts`, `messaging.module.ts`, `backend/src/events/event-types.ts`, `messaging.integration.ts`.

**Interfaces:**

- Event `conversation:typing`, input `{conversationId: string; isTyping: boolean}`.
- Output `{conversationId: string; userId: string; streamId: string; isTyping: boolean}`; streamId lấy socket.id, userId lấy client.data.userId.
- `MessagingService.getTypingRecipient(userId: string, conversationId: string): Promise<string>`: membership qua repository nội bộ rồi tìm đối phương; outsider bị từ chối.
- `MessagingTypingGateway.handleTyping(client: Socket, input: unknown): Promise<void>`: gateway namespace `/`, chỉ nhận client đã có userId/sessionId do EventsGateway xác thực. Sau validation/rate limit, lấy token từ handshake theo cùng cách EventsGateway và gọi `AccessSessionService.verifyAccessToken(token)`; sub/sessionId phải khớp client.data. Auth lỗi thì disconnect để luồng recovery hiện có refresh và reconnect; payload không được chứa token.
- Rate limits đề xuất: start/heartbeat 1 lần/2000ms cho mỗi socket/conversation; tổng 30 event/10 giây/socket gồm stop; không để throttle heartbeat chặn stop. Dọn maps khi disconnect và giới hạn số entry bằng cửa sổ thời gian.

- [ ] Viết tests payload sai, isTyping không phải boolean, giả userId/recipientId bị loại hoặc từ chối; chưa auth/outsider/revoked session không relay; thành viên chỉ chuyển đến room đối phương; heartbeat lúc 0/1999/2000ms chỉ chấp nhận 0/2000; stop ngay sau start được chuyển; spam tổng bị chặn; disconnect giải phóng state.
- [ ] Chạy `npm run test:messaging -w backend`, xác nhận tests mới fail vì thiếu handler.
- [ ] Implement DTO và handler, public service method và đăng ký gateway. Gateway gọi EventsGateway.pushToUser; không tạo dependency ngược từ EventsGateway sang MessagingService. Không emit unread/read hoặc ghi database.
- [ ] Chạy `npm run test:messaging -w backend` và `npm run test:gateway -w backend`; kỳ vọng PASS. Mở rộng integration với hai socket thành viên và outsider, kiểm tra recipient isolation và không thay đổi unread.
- [ ] Chạy `npm run test:messaging:integration -w backend` trên DB cục bộ thử nghiệm đã migrate rồi commit phần gateway.

### Task 2: Điều khiển typing trên socket hiện tại

**Files:** Modify `frontend/src/app.tsx`, `frontend/src/realtime.ts`, `frontend/checks/realtime.test.ts`; create `frontend/src/inbox/typing.ts`, `use-typing.ts`, `frontend/checks/typing.test.ts`.

**Interfaces:**

- `emitTyping(conversationId: string, isTyping: boolean): void` trong realtime.ts; một emitter bind/unbind theo vòng đời socket tại app, chỉ `socket.volatile.emit` khi connected, không buffer.
- Relay `disconnect` vào `mxh:realtime` cạnh connect hiện có.
- `createTypingController({conversationId, userId, emit, now, schedule, cancel, onChange})` trả `changed(text), stop(), receive(payload), disconnected(), dispose()`; timer functions inject cho unit tests.
- `useTyping(conversationId: string, userId: string)` trả `{isPeerTyping: boolean, changed(text: string): void, stop(): void}`. Lọc event đúng conversation, đúng peer và streamId hợp lệ; sender userId của mình bị bỏ qua.
- Receiver map streamId → expiry, mỗi start gia hạn 4000ms; stop chỉ xóa stream đó. Reset map khi disconnect/thread đổi; không tự bắt đầu từ bản nháp ban đầu.

- [ ] Viết fake-clock tests: changed lần đầu start; trong 1999ms không thêm; thay đổi ở 2000ms gửi heartbeat; receiver hết hạn tại 4000ms; empty/stop phát false; chỉ chọn ảnh không gọi changed; hai streams dừng một vẫn true; khác conversation/self/malformed bị bỏ qua; disconnect/dispose xóa timer/state.
- [ ] Viết tests socket bridge disconnected không emit, connected dùng volatile, cleanup unbind đúng emitter, reconnect không replay; chạy `npm test -w frontend` và thấy fail đúng interface mới.
- [ ] Implement controller và bridge trên socket hiện có. Hook nghe realtime, blur/visibilitychange và unmount để stop; heartbeat chỉ do input thay đổi, không setInterval phát khi người dùng đã ngừng gõ. isTyping=false khi text rỗng; disconnected không tạo emit có buffer.
- [ ] Chạy `npm test -w frontend` và `npm run build -w frontend`; kỳ vọng PASS, realtime recovery cũ vẫn hoạt động.
- [ ] Commit controller/socket integration.

### Task 3: Indicator và kiểm chứng hai tài khoản

**Files:** Modify `frontend/src/inbox/thread.tsx`, `inbox.css`, `frontend/checks/live.test.mjs`, `frontend/checks/browser.test.mjs`; update `frontend/README.md`.

**Interfaces:** Hook Task 2 được gọi trong Thread. textarea onChange gọi changed với giá trị mới, submit hợp lệ gọi stop ngay khi bắt đầu gửi; picker/upload không gọi changed. Indicator dùng peer displayName hoặc username, chỉ render khi isPeerTyping.

- [ ] Thêm browser checks: A gõ, B thấy indicator; stop/clear/send ẩn; không gõ tiếp thì tự ẩn sau 4 giây kể từ event cuối; tab ẩn/rời thread ẩn; hai tab A gõ và một tab dừng không tắt stream còn hoạt động.
- [ ] Thêm assertions socket typing không tạo request reload conversations/messages và không tăng unread; reconnect không làm indicator cũ xuất hiện; layout 390px không tràn ngang.
- [ ] Chạy browser checks để thấy UI chưa có; tích hợp hook, copy và CSS trong header; vùng indicator giữ chiều cao ổn định, không làm log nhảy mỗi lần bật/tắt. Không thêm sự kiện typing vào invalidation model.
- [ ] Chạy `npm test`, `npm run lint`, `npm run build` tại root và browser checks theo README. Chạy `npm run test:live -w frontend` với `MXH_LIVE_TEST_URL` trên deployment/DB thử nghiệm cục bộ; ghi rõ nếu môi trường live chưa sẵn sàng.
- [ ] Review dependency gateway, timer cleanup, nhiều tab và auth trước khi commit/bàn giao; ghi bằng chứng lệnh kiểm chứng.

## Handoff

Triển khai kế hoạch ảnh trước rồi typing để giảm xung đột tại thread.tsx. Không có công cụ subagent trong phiên hiện tại; lựa chọn khả dụng là thực hiện tuần tự trong phiên bằng executing-plans và tự review. Nếu sau này có subagent, dùng chúng cho review độc lập, không tuyên bố đã có review độc lập khi chưa chạy.
