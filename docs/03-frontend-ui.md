# Frontend MXH

Frontend là SPA React + TypeScript, build bằng Vite. Xem [hướng dẫn chạy và triển khai](../frontend/README.md).

- `frontend/src/app.tsx`: điều hướng, vòng đời phiên, khung giao diện và chuyển tiếp sự kiện Socket.IO.
- `frontend/src/api.ts`: REST tại `/api/v1`, gửi cookie refresh, giữ access token trong bộ nhớ và dùng chung một lần refresh cho các yêu cầu đồng thời.
- `frontend/src/auth.tsx`: đăng nhập, đăng ký, xác minh OTP và đặt lại mật khẩu.
- `frontend/src/social/`, `frontend/src/people/`, `frontend/src/inbox/`: các màn hình nghiệp vụ và trạng thái dữ liệu tương ứng; backend là nguồn sự thật.
- `frontend/src/style.css`: token màu, chữ, điều hướng responsive và các điều khiển dùng chung.
- `frontend/checks/`: unit tests, smoke test trình duyệt và kiểm thử hai tài khoản với backend thực.

Khi triển khai, reverse proxy phải chuyển `/api/v1` và `/socket.io` trước khi fallback về `index.html` cho các URL của SPA. Tài liệu backend và sơ đồ lịch sử dùng thuật ngữ Next.js không mô tả phiên bản frontend này.
