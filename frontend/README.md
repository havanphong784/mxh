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

## Triển khai

Phục vụ `frontend/dist/` bằng static host. Chuyển tiếp `/api/v1/*` và `/socket.io/*` (bao gồm WebSocket upgrade) đến backend **trước** quy tắc fallback về `index.html` cho các URL của app. Cấu hình cùng origin là lựa chọn mặc định; cookie làm mới phiên có `SameSite=Lax` và chỉ được gửi bảo mật khi backend ở production. Nếu frontend phải gọi backend trực tiếp, đặt `VITE_API_ORIGIN` thành origin HTTPS của backend (không có `/api/v1`) trước lúc build, cập nhật CORS và dùng cùng site để cookie refresh hoạt động. Không đặt secret vào biến `VITE_*`.

### Kiểm thử với backend thật

Với backend cấu hình **database cục bộ riêng cho kiểm thử** và đã nạp seed theo `backend/README.md`, chạy `MXH_LIVE_TEST_URL=http://localhost:3000 npm run test:live -w frontend`. Bài kiểm thử tạo bài viết, dấu trang và tin nhắn thật; không chạy trên database cần giữ dữ liệu. Có thể đặt `MXH_TEST_PASSWORD` nếu seed được tạo bằng mật khẩu khác.
