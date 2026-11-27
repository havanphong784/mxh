# Thiết kế Messenger: gửi ảnh và đang nhập

Ngày: 2026-11-26
Trạng thái: phạm vi và hành vi được người dùng chốt trong hội thoại; các lựa chọn kỹ thuật bên dưới là đề xuất của người lập thiết kế để phục vụ kế hoạch triển khai.

## Mục tiêu

Hoàn thiện chat riêng 1–1 với gửi ảnh và trạng thái đối phương đang nhập. Giữ luồng chat văn bản, realtime, phân trang, bản nháp và chống gửi trùng hiện tại.

## Phạm vi đã chốt

- Tối đa 5 ảnh mỗi tin, 10 MB mỗi ảnh. Hỗ trợ JPEG, PNG, WebP, GIF.
- Xem trước, bỏ từng ảnh, lời nhắn tùy chọn; cho gửi tin chỉ có ảnh.
- Hiện tiến trình từng ảnh, cho thử lại ảnh lỗi. Chỉ gửi tin khi toàn bộ ảnh tải lên thành công.
- Giữ nội dung và ảnh đã upload khi gửi lỗi để thử lại mà không tạo tin trùng.
- Nhóm ảnh trong một bong bóng; bấm xem lớn và chuyển giữa các ảnh.
- Danh sách hội thoại ưu tiên lời nhắn; tin chỉ có ảnh hiển thị “Đã gửi N ảnh”, có tiền tố “Bạn: ” khi phù hợp.
- Ảnh dùng URL công khai: bất kỳ ai có URL đều xem được, không cần đăng nhập MXH.
- Hiện “Tên người dùng đang nhập…” dưới tên đối phương trong cuộc trò chuyện.
- Phát khi nội dung ô soạn thay đổi, tối đa một tín hiệu đang nhập mỗi 2 giây. Tự ẩn khoảng 4 giây sau tín hiệu cuối.
- Phát dừng khi gửi tin, xóa hết nội dung hoặc rời cuộc trò chuyện. Chọn ảnh/chờ upload không tạo trạng thái đang nhập.
- Chỉ thành viên được phát đến đối phương; không lưu typing trong database.
- Dọn định kỳ ảnh đã upload nhưng không được gửi.

Ngoài phạm vi: video, file, reaction, sửa/thu hồi tin, đã xem, nhóm chat, mã hóa đầu cuối, đổi thiết kế toàn bộ hộp thư.

## Các phương án đã cân nhắc

### Ảnh công khai và ảnh có kiểm soát truy cập

1. URL công khai: tận dụng Cloudinary hiện có, tải trực tiếp qua CDN; người có đường dẫn có thể xem ảnh. Người dùng chọn phương án này.
2. Ảnh được bảo vệ và URL có thời hạn: kiểm tra thành viên trước khi cấp URL, cần thêm luồng cấp quyền và làm mới URL. Không được chọn cho đợt này.

### Kiểu gửi ảnh

1. Một ảnh mỗi tin: đơn giản hơn nhưng bất tiện khi gửi cả nhóm.
2. Tối đa 5 ảnh trong một tin: một lời nhắn chung, xem trước và thử lại từng ảnh. Người dùng chọn phương án này.

### Truyền trạng thái đang nhập

Dùng Socket.IO hiện có là lựa chọn của người lập thiết kế. Polling hoặc lưu database làm tăng request/ghi dữ liệu cho một trạng thái chỉ sống vài giây. Không mở kết nối Socket.IO thứ hai.

## Nền tảng hiện tại

Frontend là React 19 + TypeScript + Vite, theo `docs/03-frontend-ui.md`; tài liệu kiến trúc cũ có nhắc Next.js không mô tả frontend hiện tại. `frontend/src/app.tsx` sở hữu socket và chuyển sự kiện vào `mxh:realtime`. `frontend/src/inbox/thread.tsx` soạn/gửi văn bản; `model.ts` quản lý khóa chống trùng.

Backend NestJS + Fastify, Prisma 8 contract và PostgreSQL. `MessagingService` gửi tin qua REST rồi phát realtime qua `EventsGateway`. Message hiện chỉ có TEXT và body bắt buộc. Upload Cloudinary hiện có chỉ cho avatars/banners/posts; bộ xác minh media đang gắn prefix posts. Chưa có trình dọn ảnh chat mồ côi.

## Thiết kế gửi ảnh

Các quyết định kỹ thuật sau do người lập thiết kế đề xuất:

- Upload trực tiếp Cloudinary trong thư mục `mxh/{userId}/messages`, dạng ảnh công khai. Xin chữ ký qua endpoint riêng trong MessagingModule, có kiểm tra thành viên cuộc trò chuyện trước khi cấp.
- Dùng upload ảnh có tiến trình thật qua XMLHttpRequest; hủy request khi bỏ ảnh/rời màn hình. Giới hạn 10 MB được cụ thể hóa là 10 * 1024 * 1024 bytes, cả client và server kiểm tra.
- Backend lấy metadata thật từ Cloudinary để xác minh resource type, định dạng và bytes trước khi gắn ảnh vào tin. Chữ ký public_id/version hiện tại không tự chứng minh bytes/format.
- `MessageMedia` chứa id, messageId, publicId duy nhất, url, width, height, format, bytes, order. Message type thêm IMAGE cho tin có ảnh, có hoặc không caption. body trong DB giữ chuỗi, dùng chuỗi rỗng cho tin chỉ có ảnh để tránh đổi nullable không cần thiết.
- Request gửi tin mở rộng `{clientMessageId, body?, media?: [{publicId, version, signature}]}`. Backend tự tạo URL và metadata, không tin URL hay kích thước do client gửi. Tối đa 5 ảnh, không trùng publicId, đúng prefix người gửi. Response luôn có `media: []` kể cả tin văn bản.
- Tạo Message + MessageMedia + cập nhật Conversation trong cùng transaction. Xác minh Cloudinary trước transaction; phát socket sau commit.
- Retry cùng clientMessageId trả lại tin đã lưu, gồm media, không tạo thêm tin hay phát thêm sự kiện. Frontend giữ ID khi thử lại cùng body + danh sách ảnh có thứ tự; đổi nội dung tạo ý định gửi mới.
- Đọc media theo lô cho trang tin và các lastMessage, tránh query từng ảnh/từng hội thoại.
- Upload thành công được giữ trong bộ nhớ của màn hình để retry; bản nháp văn bản tiếp tục dùng sessionStorage. Không cam kết giữ File/ảnh chờ sau reload hoặc rời trang trong đợt này.
- Gửi lỗi không xóa caption hay ảnh; phần tải ảnh thành công không phải upload lại. Khóa sửa bản gửi trong lúc submit để tránh xóa nhầm nội dung mới.
- Trình xem ảnh hỗ trợ đóng bằng Escape, chuyển ảnh bằng bàn phím, trả focus về ảnh đã mở, phù hợp màn hình điện thoại. Ảnh tải chậm có khung giữ tỷ lệ để hạn chế nhảy cuộn.

Luồng người dùng:

```text
[Người nhận]
  [ảnh 1] [ảnh 2] [ảnh 3]
  Lời nhắn tùy chọn

[ảnh xem trước ×] [ảnh xem trước ×]
[Viết tin nhắn…                 ] [Thêm ảnh] [Gửi]
```

### Dọn ảnh không được gửi

Thêm script chạy định kỳ, mặc định dry-run, chỉ xét prefix messages. Ảnh không có MessageMedia tham chiếu và cũ hơn 24 giờ được xem là ứng viên. Thực thi xóa và gắn ảnh vào tin phải dùng cùng khóa theo publicId ở DB, kiểm tra lại tham chiếu dưới khóa; không giữ DB transaction trong lúc gọi Cloudinary. Dùng bản ghi trạng thái xóa để chặn gắn mới sau khi đã nhận xóa; xóa Cloudinary lỗi được retry. Tin đang gửi với ảnh bị dọn phải nhận lỗi rõ ràng để upload lại, không lưu tin trỏ đến ảnh mất. Script có phân trang, dry-run và hướng dẫn lịch chạy trong runbook.

## Thiết kế đang nhập

- Gateway riêng của MessagingModule xử lý `conversation:typing` với input `{conversationId, isTyping}`; định danh người gửi lấy từ socket đã xác thực, không lấy userId/recipientId từ input.
- Gateway gọi public method của MessagingService kiểm tra thành viên và xác định đối phương; không inject MessagingRepository từ module khác, không tạo vòng phụ thuộc EventsGateway → MessagingService → EventsGateway.
- Server chuyển đến room của đối phương `{conversationId, userId, streamId, isTyping}`. streamId phân biệt socket/tab, không lấy từ client. Chặn payload sai và giới hạn start/heartbeat theo socket + conversation; tín hiệu stop không bị chặn bởi giới hạn heartbeat.
- Receiver lưu từng stream trong RAM và hết hạn sau 4 giây; hiển thị khi còn ít nhất một stream của đối phương. Một tab dừng không làm tắt tab khác còn gõ.
- Client phát heartbeat mỗi 2 giây chỉ khi có thay đổi nội dung. Dừng khi submit, nội dung rỗng, blur/ẩn tab hoặc unmount; không phát typing chỉ vì phục hồi bản nháp.
- Khi mất socket, xóa trạng thái nhận ngay; không xếp hàng phát lại tín hiệu cũ sau reconnect. Nếu không nhận stop, timeout tự xóa.
- Typing không tăng unread, không đánh dấu đã đọc và không làm reload danh sách/lịch sử.

## Kiểm chứng khi triển khai

Ảnh: tin text cũ vẫn hoạt động; 1 và 5 ảnh; ảnh thứ 6; đúng 10 MiB và vượt giới hạn; file giả MIME; prefix/chữ ký sai; ảnh có caption/không caption; lỗi ảnh thứ hai; retry sau timeout đã commit; thứ tự ảnh; phân trang/lastMessage/realtime đầy đủ; dọn ảnh không xóa ảnh đã gắn.

Typing: hai tài khoản và người ngoài; tối đa 1 heartbeat/2 giây; ẩn sau 4 giây; xóa nội dung/gửi/rời trang; nhiều tab; mất mạng/reconnect; không tăng unread hay reload dữ liệu.

Browser: desktop và mobile, xem ảnh lớn/bàn phím/focus, cuộn khi ảnh tải muộn. Upload thật dùng tài khoản Cloudinary thử nghiệm, database thử nghiệm và tệp fixture; không tuyên bố kiểm chứng upload thật từ mock.

## Tổ chức công việc

Hai kế hoạch riêng: gửi ảnh trước, đang nhập sau. Mỗi phần có thể được kiểm thử và review riêng. Chưa triển khai sản phẩm trong giai đoạn thiết kế/kế hoạch.
