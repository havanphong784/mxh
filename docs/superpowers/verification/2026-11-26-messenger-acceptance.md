# Nghiệm thu Messenger: ảnh và trạng thái đang nhập

Ngày: 2026-11-26. Áp dụng cho hai plan `2026-11-26-messenger-images.md` và `2026-11-26-messenger-typing.md` cùng spec `2026-11-26-messenger-images-typing-design.md`.

## Kết quả

| Phạm vi                                                           | Kết quả                                                               |
| ----------------------------------------------------------------- | --------------------------------------------------------------------- |
| Images 1: quyền cấp upload, chữ ký, metadata thật                 | Đã triển khai; unit tests và upload Cloudinary thật đạt               |
| Images 2: migration, persistence, history, preview, deduplication | Đạt trên PostgreSQL tạm và live Chromium                              |
| Images 3: composer, upload, progress, giữ ảnh khi lỗi, retry      | Unit/browser fixtures đạt; retry với upload thật đạt                  |
| Images 4: orphan cleanup, reservation, cạnh tranh gửi/dọn         | Unit và integration PostgreSQL đạt; cron chỉ được mô tả trong runbook |
| Images 5: grid, viewer, bàn phím/focus, cuộn, mobile              | Browser fixtures đạt                                                  |
| Typing 1: session/membership, throttling, socket relay            | Unit, Socket.IO transport và DB integration đạt                       |
| Typing 2: socket hiện có, volatile, expiry theo stream, cleanup   | Unit tests đạt                                                        |
| Typing 3: indicator, nhiều tab, không reload/unread               | Live Chromium hai tài khoản, gồm hai tab dùng chung cookie, đạt       |

## Bằng chứng chạy trong lượt nghiệm thu

- `npm test`: 230 tests đạt (frontend 56, backend 174), không có failure.
- `npm run build`: cả backend và frontend đạt; Prisma contract được emit.
- `npm run lint`: exit 0. Biome còn 755 warnings và 9 infos; backend ESLint còn 536 warnings, 0 errors; frontend ESLint sạch. Đây là lint đạt theo exit code, không phải zero-warning.
- `npm run test:browser -w frontend`, với Vite do tiến trình kiểm thử sở hữu: đạt desktop/mobile, grid 1/5 ảnh, viewer/keyboard/focus, ảnh lỗi/tải muộn, lỗi giữa nhóm upload, retry khi mất phản hồi sau commit và typing nhiều stream.
- Runner DB cục bộ tạm: áp dụng 5 migrations (87 operations), chạy `npm run test:messaging:integration -w backend`, seed rồi chạy `npm run test:live -w frontend`. DB được xóa trong `finally`.
- Live bật `MXH_TEST_SHARED_COOKIE_TABS=1`: hai tab cùng cookie giữ phiên; typing một tab dừng không làm tắt stream còn lại; expiry/clear và realtime delivery đạt.
- Sau khi người dùng xác nhận cho phép dùng cloud trong `backend/.env`, chạy live với `MXH_TEST_CLOUDINARY=1` và `MXH_TEST_CLOUDINARY_CLOUD_NAME` khớp cloud đã xác nhận. Chromium upload trực tiếp 1 PNG có caption rồi 5 PNG không caption. Backend xác minh metadata thật, người nhận thấy ảnh và history sau reload giữ đúng hai nhóm mới.
- Trong lần gửi 5 ảnh, test để backend commit rồi bỏ phản hồi HTTP. Retry trả cùng message ID, cùng ordered payload/clientMessageId và tổng số upload vẫn là 6. Không mock Cloudinary hoặc metadata trong kịch bản này.
- Cleanup của test xóa 6/6 asset vừa tạo; kiểm tra riêng các asset gần đây dưới prefix tài khoản seed cho kết quả 0 còn lại. Không quét hay xóa ảnh cũ của người dùng khác.
- `git diff --check`: đạt.

Lần chạy Cloudinary đầu bị giới hạn thời gian của runner; một lần sau phát hiện URL chặn phản hồi trong test dùng route trang thay cho route REST. Đã tăng thời gian cho chế độ cloud và sửa URL của test; lần chạy cuối hoàn tất thành công. Đây là sửa bộ kiểm thử, không phải sửa luồng gửi ảnh để khớp mock.

## Quyết định và giới hạn

- Theo yêu cầu tiếp tục toàn bộ phần còn lại, sửa các lỗi lint chặn cổng root, gồm import/format cơ học trên các file ngoài messaging. Các callback `forEach` ghi rõ bỏ giá trị trả về; các biến test được khai báo kiểu. Chi phí: diff rộng hơn phần tính năng.
- Giữ dependency cố ý của effect cho retry, refresh và phục hồi cuộn; ghi suppression cục bộ có lý do. Giữ autofocus trong panel/dialog do người dùng mở và native search forms. Không tắt rule toàn repo. Media audio/video hiện chưa có caption track do người dùng cung cấp; limitation này được ghi ngay tại player.
- Worktree hiện có được giữ nguyên, chưa commit/merge/push. Những bước commit trong plan chưa thực hiện; không coi nghiệm thu là đã tích hợp nhánh.
- Tự review theo checklist `requesting-code-review`, không có công cụ subagent/reviewer độc lập. Không phát hiện Critical/Important trong lượt review cuối. Cần reviewer độc lập trước merge nếu quy trình dự án yêu cầu.
- Deferred: cảnh báo Biome/ESLint cũ; caption track cho audio/video ngoài phạm vi ảnh chat; trình duyệt không có BroadcastChannel và nhiều tab cùng khởi động lạnh chưa được kiểm chứng end-to-end.

## Chạy lại upload thật

Xem `frontend/README.md`. Cần database/deployment cục bộ riêng có seed và cloud thử nghiệm được xác nhận. Cung cấp credential qua môi trường của test; không đặt secret trong frontend build hoặc `VITE_*`. Test sẽ tạo/xóa 6 asset và để các tin thử nghiệm trong DB thử nghiệm. Nếu tiến trình bị kill trước `finally`, dùng quy trình dọn ảnh tin nhắn trong runbook để xử lý asset còn lại.
