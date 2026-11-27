# MXH · giao diện web

Frontend React + TypeScript + Vite, viết mới dựa trên hợp đồng REST và Socket.IO của backend hiện tại. Không chạy trên Next.js.

## Chạy cục bộ

Cần Node.js 22.18+ và backend đã được cấu hình. Tại thư mục gốc repo:

```sh
npm ci
npm run dev -w backend
# Terminal khác:
npm run dev -w frontend
```

Mở `http://localhost:3000`. Vite chuyển tiếp `/api/v1` và `/socket.io` đến `http://localhost:5000`. Nếu backend chạy cổng khác, sao chép `frontend/.env.example` thành `frontend/.env.local` và sửa `MXH_BACKEND_URL`.

```sh
npm run lint -w frontend
npm test -w frontend
npm run build -w frontend
# Khi Vite đang chạy và Chromium của Playwright đã được cài:
npm run test:browser -w frontend
```

### Ảnh và trạng thái đang nhập

Tin nhắn hỗ trợ tối đa 5 ảnh JPEG/PNG/WebP/GIF, mỗi ảnh tối đa 10 MiB; URL ảnh công khai. Lỗi upload giữ ảnh đã tải thành công; lỗi gửi giữ caption/ảnh và dùng lại khóa gửi cho cùng payload. Viewer hỗ trợ phím trái/phải, Escape và trả focus về ảnh đã mở. Rời cuộc trò chuyện hủy upload; chỉ bản nháp văn bản được phục hồi sau reload.

Typing dùng socket hiện có và emit volatile: phát từ thay đổi nội dung tối đa một lần mỗi 2 giây; tự ẩn sau 4 giây. Nhiều tab có stream riêng; dừng một tab không tắt tab khác. Gửi, xóa nội dung, ẩn tab hoặc rời cuộc trò chuyện phát dừng; disconnect xóa trạng thái, không replay sau reconnect. Typing không làm reload dữ liệu hoặc tăng unread.

`test:browser` có REST/Cloudinary fixtures để kiểm tra grid 1/5 ảnh, viewer/focus, lỗi upload giữa nhóm, retry sau mất phản hồi commit, không upload lại ảnh thành công, viewport 390px và typing nhiều stream/timeout/disconnect. Đây không phải bằng chứng upload Cloudinary thật. `test:live` bổ sung hai tài khoản thật kiểm tra nhận/ẩn typing và không reload dữ liệu. Integration DB trong `backend/README.md` kiểm tra media persistence và cạnh tranh cleanup/gửi với metadata Cloudinary được mock.

`test:live` mặc định dùng các phiên đăng nhập độc lập cho cùng tài khoản để kiểm tra nhiều stream typing. Chạy thêm `MXH_TEST_SHARED_COOKIE_TABS=1` để kiểm tra hai tab dùng chung cookie: tab mới nhận access token qua BroadcastChannel trong bộ nhớ trước khi xoay refresh cookie. Kịch bản này đã chạy thành công bằng Chromium trên DB tạm.

`test:browser` kiểm tra thêm hai tab khởi động lạnh và cùng gặp 401 với cookie xoay vòng qua REST fixture, BroadcastChannel và Web Locks thật trên Chromium: mỗi đợt chỉ gọi refresh HTTP một lần. Token bị từ chối hoặc đã hết hạn không được dùng lại; request chỉ replay tối đa một lần. Khi thiếu cả BroadcastChannel và Web Locks, refresh vẫn hữu hạn nhưng tab thua cuộc có thể phải đăng nhập lại; không bảo đảm phục hồi đồng thời trên mọi trình duyệt. Login/logout ở tab khác xóa shell, draft và socket của phiên cũ, không gửi draft dưới tài khoản mới. Các kiểm tra fixture này không thay thế integration auth với backend thật.

Kiểm tra upload Cloudinary thật bằng tài khoản cloud và deployment/database riêng cho thử nghiệm. Đặt `MXH_TEST_CLOUDINARY=1` cùng `MXH_TEST_CLOUDINARY_CLOUD_NAME` bằng tên cloud thử nghiệm đã xác nhận, và cung cấp `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` trong môi trường của tiến trình test (không dùng biến `VITE_*`):

```sh
MXH_TEST_CLOUDINARY=1 MXH_TEST_CLOUDINARY_CLOUD_NAME=<test-cloud> \
  MXH_LIVE_TEST_URL=http://localhost:3000 npm run test:live -w frontend
```

Chế độ này upload 1 ảnh với caption rồi 5 ảnh không caption từ Chromium, kiểm tra nhận/lịch sử, cố ý bỏ phản hồi sau commit và thử lại cùng payload/ID mà không upload lại. Kịch bản đã chạy thành công trên cloud được người dùng xác nhận trong lượt nghiệm thu 2026-11-26; xem [báo cáo nghiệm thu](../docs/superpowers/verification/2026-11-26-messenger-acceptance.md). Test xóa đúng các asset vừa được upload trong `finally`; không quét hoặc xóa inventory cũ. Thông tin asset chỉ sống trong tiến trình, nên nếu bị kill/crash cần dọn các ảnh thử nghiệm còn lại bằng quy trình cleanup. Không dùng cấu hình production để nghiệm thu. Kịch bản upload thật chỉ được coi là đạt khi đã chạy với cloud thử nghiệm; các test fixture không thay thế bước này.

## Triển khai

Phục vụ `frontend/dist/` bằng static host. Chuyển tiếp `/api/v1/*` và `/socket.io/*` (bao gồm WebSocket upgrade) đến backend **trước** quy tắc fallback về `index.html` cho các URL của app. Cấu hình cùng origin là lựa chọn mặc định; cookie làm mới phiên có `SameSite=Lax` và chỉ được gửi bảo mật khi backend ở production. Nếu frontend phải gọi backend trực tiếp, đặt `VITE_API_ORIGIN` thành origin HTTPS của backend (không có `/api/v1`) trước lúc build, cập nhật CORS và dùng cùng site để cookie refresh hoạt động. Không đặt secret vào biến `VITE_*`.

### Kiểm thử với backend thật

Với backend cấu hình **database cục bộ riêng cho kiểm thử** và đã nạp seed theo `backend/README.md`, chạy `MXH_LIVE_TEST_URL=http://localhost:3000 npm run test:live -w frontend`. Bài kiểm thử tạo bài viết, dấu trang và tin nhắn thật; không chạy trên database cần giữ dữ liệu. Có thể đặt `MXH_TEST_PASSWORD` nếu seed được tạo bằng mật khẩu khác.
