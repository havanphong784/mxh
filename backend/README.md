# Kiểm thử messaging

Kiểm thử tích hợp REST và WebSocket với PostgreSQL thật, bao gồm phân trang, phân quyền, gửi tin nhắn, chống tạo trùng khi retry, realtime và trạng thái đã đọc. Chỉ chạy với **database PostgreSQL cục bộ dành riêng cho kiểm thử**, đã tạo schema và chạy migration. Không trỏ tới database production hoặc database có dữ liệu cần giữ.

Từ thư mục `backend`, đặt `MESSAGING_TEST_DATABASE_URL` tới database đó rồi chạy:

```bash
MESSAGING_TEST_DATABASE_URL='postgresql://postgres:password@localhost:5432/mxh_test' npm run test:messaging:integration
```

Lệnh từ chối host không phải loopback và từ chối `NODE_ENV=production`. Kiểm thử tự đặt `DATABASE_URL` theo biến trên, tạo các tài khoản fixture ngẫu nhiên rồi xóa chúng khi kết thúc; nó không tạo migration hoặc xóa schema. Kiểm thử đơn vị messaging không cần database: `npm run test:messaging`.

# Dữ liệu mẫu để kiểm thử

Sau khi đã tạo database và chạy migration, từ thư mục `backend`:

```bash
npm run seed:check
npm run seed -- --dry-run
npm run seed
```

Seed tạo 19 tài khoản, hơn 100 bài viết và các quan hệ theo dõi, trả lời, trích dẫn, repost, thích, lưu bài, thông báo, phiên đăng nhập và OTP hết hạn. Nội dung có tiếng Việt, ảnh/video minh họa, bài nhiều ảnh, bài chỉ có ảnh, bài đã sửa/xóa, bài chỉ người theo dõi, bài riêng tư và hội thoại nhiều tầng. Thời điểm được trải trong khoảng ba tháng trước ngày chạy để dễ thử phân trang.

Đăng nhập với `minhthu@example.test` (hoặc tài khoản đã xác minh khác) và mật khẩu `Demo1234!`. Đặt `SEED_PASSWORD` để chọn mật khẩu khác **trước lần chạy đầu**. `quocbao@example.test` chưa xác minh email; `thuha@example.test` không hoạt động; `mocmai@example.test` có hồ sơ trống. Email `.test` chỉ dùng cho dữ liệu giả, không gửi thư được.

Lệnh chạy lại không nhân bản và không ghi đè nội dung bản ghi seed đã được chỉnh sửa; bộ đếm tương tác của bài seed được đồng bộ từ các quan hệ thực tế. Seed chỉ chạy khi `NODE_ENV` khác `production` và URL database trỏ tới localhost. Với database thử nghiệm ở máy khác, thêm `--allow-remote`. Ảnh và video tham chiếu tài nguyên công khai; nếu thiết bị không có mạng, nội dung văn bản và quan hệ vẫn dùng được nhưng media sẽ không hiển thị.
