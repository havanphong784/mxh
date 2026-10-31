# 05. Vận Hành, Triển Khai & Xử Lý Sự Cố (Deployment & Incident Runbook)

Tài liệu này là **Cẩm Nang Vận Hành & Ứng Cứu Sự Cố (Production Runbook)** của dự án Mạng Xã Hội (MXH). Tài liệu quy định chi tiết ma trận môi trường, quy trình CI/CD đóng gói ứng dụng, chiến lược sao lưu phục hồi cơ sở dữ liệu, hệ thống giám sát và các kịch bản hành động chuẩn (Standard Operating Procedures - SOP) khi xảy ra sự cố khẩn cấp trên môi trường Production.

---

## 1. Môi Trường & Cấu Hình Triển Khai (Environments & Infrastructure Matrix)

### 1.1. Ma Trận Môi Trường Hệ Thống

| Tiêu chí | Local Development | Staging / Pre-Production | Production |
| :--- | :--- | :--- | :--- |
| **Mục đích** | Phát triển tính năng, debug, chạy unit/integration test. | Kiểm thử tích hợp E2E, diễn tập tải (Load test), nghiệm thu trước release. | Phục vụ người dùng thực tế với lưu lượng truy cập cao. |
| **Frontend URL** | `http://localhost:3000` | `https://staging.mxh.domain` | `https://mxh.domain` |
| **Backend API** | `http://localhost:5000/api/v1` | `https://api-staging.mxh.domain/api/v1` | `https://api.mxh.domain/api/v1` |
| **Database** | PostgreSQL 16 (Local / Docker) | PostgreSQL 16 Managed (Dedicated Staging DB) | PostgreSQL 16 High-Availability (Primary + Read Replica) |
| **Cơ Chế Seed** | Hỗ trợ `npm run seed` (19 accounts, >100 posts) | Hỗ trợ Seed dữ liệu mẫu có kiểm soát | **NGHIÊM CẤM** chạy seed script (`NODE_ENV === 'production'` tự chặn) |
| **Cloudinary** | Account Test / Shared Dev Cloud | Separate Staging Folder / Bucket | Production Dedicated Cloudinary Account |
| **Email SMTP** | Ethereal Mail / Mailhog / Gmail Dev | SMTP Test Gateway | Production Amazon SES / SendGrid Transactional Mail |

---

### 1.2. Ma Trận Biến Môi Trường (Environment Variables Matrix)

#### 1. Backend (`backend/.env`)

| Tên biến | Bắt buộc | Ví dụ giá trị | Mục đích & Giải thích bảo mật |
| :--- | :---: | :--- | :--- |
| `NODE_ENV` | Có | `production` | Bật chế độ tối ưu hiệu năng của Fastify & NestJS, khóa các script seed/reset. |
| `PORT` | Có | `5000` | Cổng lắng nghe của máy chủ Fastify HTTP. |
| `DATABASE_URL` | Có | `postgresql://user:pass@host:5432/mxh_prod?sslmode=require` | Chuỗi kết nối PostgreSQL (Bắt buộc bật SSL trên Staging/Production). |
| `JWT_ACCESS_SECRET` | Có | *Chuỗi ngẫu nhiên tối thiểu 64 ký tự* | Khóa bí mật ký Access Token (Thời hạn 15 phút). |
| `JWT_ACCESS_EXPIRES_IN`| Có | `15m` | Thời gian sống của JWT Access Token trong RAM. |
| `JWT_REFRESH_SECRET` | Có | *Chuỗi ngẫu nhiên tối thiểu 64 ký tự* | Khóa bí mật ký Refresh Token trong HttpOnly Cookie. |
| `JWT_REFRESH_EXPIRES_IN`| Có | `7d` | Thời hạn sống của Refresh Token (7 ngày). |
| `COOKIE_SECRET` | Có | *Chuỗi ngẫu nhiên tối thiểu 32 ký tự* | Dùng để ký bảo vệ Cookie (`@fastify/cookie`), chống sửa đổi client-side. |
| `CORS_ORIGIN` | Có | `https://mxh.domain` | Nguồn được phép gọi API (Tuyệt đối không dùng `*` trên production). |
| `CLOUDINARY_CLOUD_NAME`| Có | `mxh-prod` | Tên đám mây lưu trữ Cloudinary. |
| `CLOUDINARY_API_KEY` | Có | `123456789012345` | API Key công khai của Cloudinary. |
| `CLOUDINARY_API_SECRET`| Có | *Chuỗi bí mật 32 ký tự* | **Bí mật tuyệt đối**: Dùng để ký và kiểm tra HMAC SHA-1 upload signature. |
| `SMTP_HOST` | Có | `smtp.sendgrid.net` | Địa chỉ máy chủ SMTP gửi mail OTP xác thực. |
| `SMTP_PORT` | Có | `465` | Cổng SMTP (465 SSL hoặc 587 TLS). |
| `SMTP_SECURE` | Có | `true` | Sử dụng giao thức TLS/SSL an toàn. |
| `SMTP_USER` | Có | `apikey` | Tài khoản đăng nhập SMTP. |
| `SMTP_PASS` | Có | *Mật khẩu / API Key gửi mail* | Mật khẩu ứng dụng hoặc khóa bảo mật gửi email. |
| `EMAIL_FROM` | Có | `"MXH Security" <no-reply@mxh.domain>` | Tên hiển thị người gửi trong hòm thư người dùng. |

#### 2. Frontend (`frontend/.env.production`)

| Tên biến | Bắt buộc | Ví dụ giá trị | Mục đích & Giải thích |
| :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_API_URL` | Có | `https://api.mxh.domain/api/v1` | URL gốc của RESTful API phục vụ Axios Client. |
| `NEXT_PUBLIC_SOCKET_URL` | Có | `https://api.mxh.domain` | Địa chỉ kết nối WebSocket của Socket.IO Gateway. |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Có | `mxh-prod` | Cloud name phục vụ client upload trực tiếp lên Cloudinary API. |

---

## 2. Quy Trình Build & Triển Khai (CI/CD & Deployment Playbook)

### 2.1. Kiến Trúc Hạ Tầng Triển Khai Thực Tế

```mermaid
graph TB
    subgraph PublicInternet ["Người Dùng & Mạng Công Cộng"]
        UserBrowser["Trình Duyệt & Mobile Web"]
    end

    subgraph CDNAndEdge ["Edge & CDN Layer (Cloudflare / Vercel Edge)"]
        WAF["WAF & DDoS Mitigation<br/>(Cloudflare Pro)"]
        FrontendVercel["Frontend Deployment (Vercel / Next.js)<br/>• Edge CDN Caching Assets<br/>• Next.js App Router Hybrid Render"]
    end

    subgraph CoreBackendCluster ["Backend Infrastructure (Docker Cluster / VPS)"]
        NginxProxy["Reverse Proxy / Nginx / Caddy<br/>• SSL/TLS Termination (Let's Encrypt)<br/>• WebSocket Upgrade ('Upgrade: websocket')<br/>• Request Timeout: 60s"]

        subgraph ComputeInstances ["Fastify NestJS Nodes (PM2 / Docker)"]
            Node1["Backend Instance 1 (Fastify :5000)<br/>Healthcheck: /api/v1/health"]
            Node2["Backend Instance 2 (Fastify :5001)<br/>Healthcheck: /api/v1/health"]
        end
    end

    subgraph ManagedPersistence ["Managed Cloud Services"]
        PostgresCluster[("Managed PostgreSQL 16 Cluster<br/>• Primary (Read/Write)<br/>• Read Replica (Queries)<br/>• Automated WAL Archiving")]
        CloudinaryCDN["Cloudinary Media CDN<br/>(Global Image/Video Delivery)"]
        SMTPGateway["Transactional Mail Gateway<br/>(AWS SES / SendGrid)"]
    end

    UserBrowser -->|"HTTPS (Static Assets & Pages)"| FrontendVercel
    UserBrowser -->|"HTTPS API (/api/v1/*)"| WAF
    UserBrowser <-->|"WSS (WebSocket Handshake)"| WAF
    UserBrowser -->|"Direct Upload File Binary"| CloudinaryCDN

    WAF --> NginxProxy
    NginxProxy --> Node1
    NginxProxy --> Node2

    Node1 --> PostgresCluster
    Node2 --> PostgresCluster
    Node1 -.->|"HMAC Signatures"| CloudinaryCDN
    Node1 -.->|"Send OTP Mail"| SMTPGateway
```

---

### 2.2. Pipeline Đóng Gói Ứng Dụng (Docker & Monorepo Build)

Dự án sử dụng **Turborepo** để tối ưu hóa quá trình build đồng thời cả Frontend và Backend:

```bash
# Lệnh build toàn bộ các package trong monorepo
npm run build # tương đương turbo run build
```

#### Dockerfile Cho Backend (NestJS 12 Fastify Multi-stage Build)

Đặt tại `backend/Dockerfile`:
```dockerfile
# ----------------------------------------------------
# Stage 1: Dependency & Build
# ----------------------------------------------------
FROM node:22-alpine AS builder
WORKDIR /app

# Cài đặt pnpm / npm và các build dependencies
RUN apk add --no-cache libc6-compat

# Copy cấu hình package
COPY package.json package-lock.json ./
COPY backend/package.json ./backend/

# Cài đặt toàn bộ dependencies
RUN npm ci

# Copy source code backend
COPY backend/ ./backend/

# Sinh Prisma Contract
WORKDIR /app/backend
RUN npm run contract:emit

# ----------------------------------------------------
# Stage 2: Production Runner
# ----------------------------------------------------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Tạo non-root user đảm bảo an ninh
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/backend ./backend

USER nestjs
WORKDIR /app/backend

EXPOSE 5000

# Khởi chạy Fastify NestJS Engine
CMD ["node", "--import", "@swc-node/register/esm-register", "src/index.ts"]
```

---

### 2.3. Chiến Lược Triển Khai Không Gián Đoạn (Zero-Downtime Deployment)

Để cập nhật phiên bản mới mà người dùng không bị ngắt quãng hoặc gặp lỗi 502 Bad Gateway:

1. **Graceful Shutdown**:
   - Backend NestJS đã kích hoạt `app.enableShutdownHooks()` tại `src/index.ts`.
   - Khi nhận tín hiệu `SIGTERM` từ Docker/Kubernetes, Fastify sẽ ngừng nhận request mới, chờ hoàn thành toàn bộ các HTTP request đang xử lý (tối đa 15 giây), ngắt kết nối an toàn với Prisma Pool và đóng toàn bộ Socket clients trước khi tiến trình tắt hoàn toàn.
2. **Healthcheck Probe (Kiểm Tra Sức Khỏe Máy Chủ)**:
   - Endpoint: `GET /api/v1/health`
   - Trả về HTTP `200 OK`:
     ```json
     {
       "status": "ok",
       "message": "Backend with NestJS & Fastify is running!",
       "timestamp": "2026-10-28T02:00:00.000Z"
     }
     ```
   - Load Balancer / Nginx chỉ định tuyến traffic vào container mới khi endpoint healthcheck trả về HTTP 200 liên tiếp 3 lần.

---

## 3. Quản Trị Cơ Sở Dữ Liệu & Sao Lưu (Database Migration & Backup Playbook)

### 3.1. Quy Trình Chạy Migration Trên Production (Migration Execution)

Trước khi kích hoạt deploy code backend mới có thay đổi về cơ sở dữ liệu:

```mermaid
flowchart TD
    Step1["1. Tạo Snapshot / Backup DB tức thời<br/>(pg_dump / Cloud Snapshot)"] --> Step2["2. Kiểm tra tính tương thích ngược<br/>(Expand and Contract Rule)"]
    Step2 --> Step3["3. Chạy lệnh sinh contract<br/>npm run contract:emit"]
    Step3 --> Step4["4. Áp dụng Migration trên Staging trước"]
    Step4 --> Step5{Test Staging Pass 100%?}
    Step5 -->|No| Rollback["Hủy bỏ Deploy, phân tích nguyên nhân"]
    Step5 -->|Yes| Step6["5. Thực thi Migration trên Production DB"]
    Step6 --> Step7["6. Kiểm tra lại tính toàn vẹn bộ đếm<br/>npm run reconcile:counters"]
```

**Quy tắc an toàn**:
- Không bao giờ chạy migration trực tiếp từ máy cá nhân lập trình viên lên Production DB.
- Migration phải được thực thi qua **CI/CD Pipeline Runner** có phân quyền giới hạn mạng (IP Allowlist).

---

### 3.2. Chiến Lược Sao Lưu Tự Động (Automated Backup & Retention)

Hệ thống đặt ra 2 chỉ số phục hồi cốt lõi:
- **RPO (Recovery Point Objective)**: $\le 15$ phút (mức dữ liệu tối đa chấp nhận mất khi thảm họa xảy ra).
- **RTO (Recovery Time Objective)**: $\le 60$ phút (thời gian tối đa để khôi phục toàn bộ hệ thống hoạt động bình thường).

#### Lịch Trình Sao Lưu:
1. **Continuous WAL Archiving (Write-Ahead Logging)**:
   - Lưu trữ liên tục các file WAL sang Cloud Object Storage (AWS S3 Glacier / Cloudflare R2), cho phép phục hồi về bất kỳ giây nào trong quá khứ (Point-In-Time Recovery - PITR) trong vòng 14 ngày.
2. **Daily Logical Dump (`pg_dump`)**:
   - Chạy tự động lúc 03:00 sáng hàng ngày:
   ```bash
   pg_dump -Fc -v -h $DB_HOST -U $DB_USER -d $DB_NAME -f "/backups/mxh_db_$(date +%Y%m%d_%H%M%S).dump"
   ```
   - Nén và mã hóa AES-256 trước khi đẩy lên S3 Backup Bucket (Lưu trữ 30 ngày).

---

### 3.3. Kịch Bản Phục Hồi Thảm Họa (Disaster Recovery & Restore Procedure)

Khi cơ sở dữ liệu gặp sự cố nghiêm trọng hoặc dữ liệu bị phá hoại:

```bash
# Bước 1: Khóa toàn bộ kết nối tới Database đang hỏng
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'mxh_prod' AND pid <> pg_backend_pid();

# Bước 2: Tạo một database mới sạch hoàn toàn
CREATE DATABASE mxh_prod_restored WITH TEMPLATE template0;

# Bước 3: Phục hồi từ bản dump gần nhất
pg_restore -v -h $DB_HOST -U $DB_USER -d mxh_prod_restored /backups/mxh_db_latest.dump

# Bước 4: Kiểm tra tính toàn vẹn dữ liệu
psql -h $DB_HOST -U $DB_USER -d mxh_prod_restored -c "SELECT count(*) FROM \"User\";"
psql -h $DB_HOST -U $DB_USER -d mxh_prod_restored -c "SELECT count(*) FROM \"Post\";"

# Bước 5: Chuyển hướng traffic backend sang DB đã phục hồi và chạy script đối soát bộ đếm
npm run reconcile:counters
```

---

## 4. Giám Sát, Nhật Ký & Cảnh Báo (Observability, Logging & Alerting)

### 4.1. Nhật Ký Có Cấu Trúc (Structured JSON Logging với Pino)

Hệ thống sử dụng **Pino Logger** (tích hợp mặc định của Fastify Engine) xuất log dưới dạng JSON dòng (NDJSON). Mỗi log line bắt buộc mang theo định danh truy vết `requestId` (Correlation ID):

```json
{
  "level": 30,
  "time": 1729998000123,
  "pid": 4821,
  "hostname": "backend-node-1",
  "reqId": "cm3a9b1c2000008l0h9x0abc1",
  "req": {
    "method": "POST",
    "url": "/api/v1/posts",
    "remoteAddress": "203.0.113.195"
  },
  "res": {
    "statusCode": 201
  },
  "responseTime": 14.8,
  "msg": "request completed"
}
```

*Lợi ích*: Dễ dàng đẩy trực tiếp vào các hệ thống tập trung nhật ký (Datadog, Loki, Grafana, AWS CloudWatch) để lọc lỗi theo `reqId` hoặc `userId`.

---

### 4.2. Ma Trận Cảnh Báo & Ngưỡng Khẩn Cấp (Alerting Rules)

| Chỉ số giám sát (Metric) | Ngưỡng cảnh báo (Threshold) | Kênh thông báo | Hành động ngay lập tức |
| :--- | :--- | :--- | :--- |
| **API Error Rate (5xx)** | $> 1\%$ trong 5 phút | Slack `#alerts-critical` + PagerDuty | Kiểm tra error log trong AllExceptionsFilter, truy vết nguyên nhân lỗi hệ thống. |
| **P95 Request Latency** | $> 800\text{ ms}$ trong 5 phút | Slack `#alerts-dev` | Kiểm tra Slow Queries trên Postgres hoặc tắc nghẽn Pool kết nối. |
| **Database Pool Busy** | $> 80\%$ pool capacity | Slack `#alerts-critical` | Kiểm tra các truy vấn giữ transaction quá lâu hoặc thiếu index. |
| **Server Memory Usage** | $> 85\%$ RAM kéo dài | Slack `#alerts-warning` | Kiểm tra hiện tượng rò rỉ bộ nhớ (Memory Leak) do WebSocket clients chưa ngắt kết nối. |
| **Healthcheck Failed** | 2 lần probe thất bại liên tiếp | PagerDuty gọi khẩn cấp | Khởi động lại container backend tự động, kiểm tra trạng thái tiến trình Fastify. |

---

## 5. Kịch Bản Xử Lý Sự Cố Khẩn Cấp (Incident Runbook & Troubleshooting Guide)

Dưới đây là **5 kịch bản sự cố thực chiến** điển hình nhất của hệ thống mạng xã hội và các bước xử lý chính xác:

---

### Kịch Bản 1: Người Dùng Bị Văng Đăng Nhập Hàng Loạt (401 Refresh Loop / Session Desync)

- **Hiện tượng**: Người dùng báo cáo đang lướt ứng dụng thì bị đẩy ra trang `/login` liên tục, hoặc console client hiện lỗi `AUTH_SESSION_REVOKED`.
- **Nguyên nhân tiềm ẩn**:
  1. Secret `COOKIE_SECRET` hoặc `JWT_REFRESH_SECRET` bị thay đổi trên server mà không thông báo.
  2. Đồng hồ máy chủ server bị lệch thời gian (NTP time drift) khiến token hết hạn ngay khi vừa cấp.
  3. Xung đột cơ chế xoay vòng Refresh Token (Token Rotation) khi client mở nhiều tab cùng lúc nhưng Single-Flight bị lỗi.
- **Quy trình xử lý (SOP)**:
  1. Kiểm tra log của `AuthService.refreshToken`:
     ```bash
     grep "AUTH_SESSION_REVOKED" /var/log/backend.log
     ```
  2. Kiểm tra đồng bộ thời gian máy chủ:
     ```bash
     timedatectl status # Đảm bảo "NTP service: active" và "System clock synchronized: yes"
     ```
  3. Kiểm tra các bản ghi trong bảng `Session`:
     ```sql
     -- Kiểm tra số lượng session bị revoke bất thường trong 1 giờ qua
     SELECT count(*), "isRevoked" FROM "Session"
     WHERE "updatedAt" > NOW() - INTERVAL '1 hour'
     GROUP BY "isRevoked";
     ```
  4. Nếu do đổi nhầm Secret: Cần rollback lại biến môi trường `COOKIE_SECRET` cũ nếu còn bản lưu, hoặc gửi thông báo bảo trì yêu cầu người dùng đăng nhập lại một lần duy nhất.

---

### Kịch Bản 2: Cơ Sở Dữ Liệu Tắc Nghẽn Kết Nối (Connection Pool Exhaustion / 504 Timeout)

- **Hiện tượng**: Mọi request API đều quay chậm 20 giây rồi báo lỗi `504 Gateway Timeout` hoặc `Timed out waiting for connection from pool after 20000ms`.
- **Nguyên nhân tiềm ẩn**:
  1. Có truy vấn chạy chậm (Slow Query) không có Index đang khóa bảng.
  2. Ai đó vi phạm **Rule 4**: bọc tác vụ I/O chậm (gửi mail SMTP hoặc upload Cloudinary) vào bên trong `prisma.transaction()`.
- **Quy trình xử lý (SOP)**:
  1. Truy vấn các câu lệnh đang chạy lâu nhất trên PostgreSQL:
     ```sql
     SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
     FROM pg_stat_activity
     WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
       AND state != 'idle'
     ORDER BY duration DESC;
     ```
  2. Kill ngay lập tức các truy vấn đang giữ khóa (Locking Queries):
     ```sql
     SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE pid = <PID_GAY_NGHEN>;
     ```
  3. Tạm thời tăng kích thước `poolSize` trong cấu hình kết nối database nếu dung lượng RAM server còn dồi dào.
  4. Kiểm tra lại code vừa deploy để tìm nơi bọc tác vụ ngoài vào Transaction.

---

### Kịch Bản 3: Sai Lệch Bộ Đếm Bài Viết & Lượt Thích (Counter Inconsistency)

- **Hiện tượng**: Bài viết hiển thị `likeCount: 15` nhưng khi mở danh sách chỉ có 10 người thích, hoặc `replyCount` bị âm / không khớp thực tế.
- **Nguyên nhân tiềm ẩn**: Sự cố mạng giữa chừng khi cập nhật bài viết con, hoặc dữ liệu seed/test chưa được đối soát.
- **Quy trình xử lý (SOP)**:
  1. Chạy script đối soát và tự động chữa lành bộ đếm (đã tích hợp sẵn trong repo):
     ```bash
     cd backend
     npm run reconcile:counters
     ```
  2. Script sẽ quét toàn bộ bảng `Post`, đếm lại chính xác số lượng từ các bảng quan hệ thực tế (`PostLike`, `PostBookmark`, `PostReplies`, `PostReposts`) và cập nhật lại giá trị chuẩn xác vào từng dòng `Post`.
  3. Kiểm tra log kết quả: Toàn bộ các bài bị lệch số sẽ được ghi nhận và đưa về đúng thực tế.

---

### Kịch Bản 4: Lỗi Upload Media / Chữ Ký Không Hợp Lệ (`MEDIA_INVALID_SIGNATURE`)

- **Hiện tượng**: Người dùng đính kèm ảnh vào bài viết, thanh tiến trình upload đạt 100% nhưng khi ấn "Đăng bài" thì nhận lỗi `400 Bad Request: Chữ ký media không hợp lệ`.
- **Nguyên nhân tiềm ẩn**:
  1. `CLOUDINARY_API_SECRET` ở backend khác với secret của tài khoản Cloudinary đang tạo signature.
  2. Client-side tự ý sửa đổi `publicId` hoặc `version` sau khi tải file lên.
  3. Quy tắc format chuỗi SHA-1 bị lệch giữa lúc ký và lúc đối chiếu.
- **Quy trình xử lý (SOP)**:
  1. Kiểm tra log chữ ký tại `PostsService.verifyMediaItems`:
     - Kiểm tra chuỗi payload tạo signature: `public_id=${publicId}&version=${version}${apiSecret}`.
  2. Đảm bảo biến môi trường `CLOUDINARY_API_SECRET` trên server không bị khoảng trắng thừa (trailing spaces).
  3. Thử tạo một upload signature mẫu qua API:
     ```bash
     curl -X GET "https://api.mxh.domain/api/v1/media/upload-signature?folder=posts&mediaType=image" \
       -H "Authorization: Bearer <VALID_TOKEN>"
     ```
  4. Xác nhận giá trị `apiKey` và `cloudName` trả về khớp chính xác với Dashboard của Cloudinary.

---

### Kịch Bản 5: Rò Rỉ Bộ Nhớ & Zombie Sockets Trên EventsGateway

- **Hiện tượng**: RAM của server backend tăng dần đều theo thời gian (Memory Leak), không hạ xuống kể cả khi ít người online. WebSocket Gateway phản hồi chậm chạp.
- **Nguyên nhân tiềm ẩn**: Client bị mất mạng đột ngột (tắt máy, chuyển mạng Wi-Fi sang 4G) nhưng sự kiện `disconnect` không kích hoạt dọn dẹp `Set<socketId>` trong Map `onlineUsers`.
- **Quy trình xử lý (SOP)**:
  1. Kiểm tra kích thước map người dùng trực tuyến trong `EventsGateway`:
     ```typescript
     // Số lượng user online thực tế vs số lượng socket kết nối
     this.logger.log(`Online users map size: ${this.onlineUsers.size}`);
     ```
  2. Cấu hình Ping/Pong timeout chặt chẽ hơn trong Socket.IO server:
     ```typescript
     // Trong cấu hình @WebSocketGateway
     pingInterval: 10000, // 10 giây ping một lần
     pingTimeout: 5000,   // 5 giây không pong -> ngắt kết nối lập tức
     ```
  3. Nếu RAM chạm ngưỡng 90%: Tiến hành khởi động lại một instance backend trong cụm (Rolling restart), instance còn lại sẽ gánh tải trong thời gian restart mà không làm rớt dịch vụ.

---

## 6. Danh Mục Kiểm Tra Khi Bàn Giao & Vận Hành (Operational Readiness Checklist)

Trước khi công bố dịch vụ cho người dùng chính thức (Go-Live):

- [ ] **Bảo mật**: Toàn bộ Secret (`JWT_*`, `COOKIE_SECRET`, `CLOUDINARY_API_SECRET`) là chuỗi ngẫu nhiên mạnh được sinh tự động, không dùng giá trị mặc định của `.env.example`.
- [ ] **Mạng & SSL**: Đã cài đặt chứng chỉ SSL/TLS A+ (Let's Encrypt / Cloudflare), bật HTTPS bắt buộc.
- [ ] **CORS**: `CORS_ORIGIN` chỉ trỏ chính xác đến domain Frontend, không để `*`.
- [ ] **Database Backup**: Cron Job sao lưu DB tự động đã hoạt động và được kiểm tra phục hồi thử thành công.
- [ ] **Healthcheck**: Endpoint `/api/v1/health` được kết nối với hệ thống Uptime Monitoring (BetterStack / UptimeKuma).
- [ ] **Scripts Kiểm Toán**: Script `npm run reconcile:counters` chạy trơn tru không phát sinh lỗi cú pháp.
- [ ] **Tài Liệu Hóa**: Bộ 5 file Playdoc (`01-architecture.md` $\rightarrow$ `05-runbook-deploy.md`) đã được cập nhật đầy đủ và đồng bộ vào repo.
