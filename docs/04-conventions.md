# 04. Quy Chuẩn Dự Án & Tiêu Chuẩn Kỹ Thuật (Engineering Conventions & Standards)

Tài liệu này thiết lập các quy chuẩn kỹ thuật bắt buộc cho toàn bộ mã nguồn của dự án Mạng Xã Hội (MXH). Đây là **Bộ Quy Ước Bắt Buộc (Conventions Law)** giúp đảm bảo tính đồng nhất, kỷ luật mã nguồn (Code Hygiene), quy trình cộng tác Git mượt mà và chuẩn hóa giao tiếp API giữa Frontend và Backend.

---

## 1. Quy Chuẩn Mã Nguồn & Định Dạng (Coding Conventions & Linting)

### 1.1. Ma Trận Quy Ước Đặt Tên (Naming Conventions Matrix)

Mọi tệp tin, biến số và thành phần trong codebase phải tuân theo bảng quy ước đặt tên thống nhất dưới đây:

| Thành phần (Target) | Quy tắc đặt tên | Ví dụ thực tế trong dự án | Ghi chú & Giải thích |
| :--- | :--- | :--- | :--- |
| **Thư mục (Directories)** | `kebab-case` | `features/posts`, `components/ui`, `access-session` | Chữ thường, phân cách bằng dấu gạch ngang, không dùng dấu cách hay camelCase. |
| **Component React (UI/JSX)** | `PascalCase` | `PostCard.tsx`, `Sidebar.tsx`, `InteractivePostCard.tsx` | Khớp 1-1 với tên component được export bên trong file. |
| **Tệp logic / service / utils** | `kebab-case.ts` | `auth.service.ts`, `single-flight.ts`, `posts.controller.ts` | Đính kèm hậu tố vai trò (`.service`, `.controller`, `.test`). |
| **Biến số & Thuộc tính (Variables)** | `camelCase` | `currentUserId`, `isEmailVerified`, `replyCount` | Rõ nghĩa, không viết tắt vô nghĩa (`usr`, `pst`). |
| **Hàm & Phương thức (Functions)** | `camelCase` (Động từ) | `getPostById()`, `generateUploadSignature()`, `verifyOtp()` | Bắt đầu bằng động từ hành động mô tả chính xác mục đích. |
| **Interface / Type Alias** | `PascalCase` | `PostItem`, `Author`, `UploadSignature`, `CursorPage<T>` | **Tuyệt đối không dùng tiền tố `I`** (như `IPostItem` - chuẩn TypeScript hiện đại bỏ tiền tố I). |
| **DTOs (Data Transfer Object)** | `PascalCase` + Hậu tố `Dto` | `CreatePostDto`, `UpdateProfileDto`, `LoginDto` | Đóng gói dữ liệu đầu vào tại Controller. |
| **Hằng số & Enum Values** | `UPPER_SNAKE_CASE` | `POST_EVENTS.CREATED`, `MAX_MEDIA_COUNT`, `DEFAULT_PAGE_SIZE` | Viết hoa toàn bộ, phân cách bằng dấu gạch dưới. |
| **Trường Boolean** | Tiền tố `is`, `has`, `should`, `can` | `isDeleted`, `hasMore`, `shouldAttemptRefresh`, `canDelete` | Giúp câu lệnh điều kiện đọc tự nhiên như văn nói tiếng Anh. |
| **Cột Cơ Sở Dữ Liệu (Prisma)** | `camelCase` (Code) $\rightarrow$ `snake_case` (DB) | Code: `authorId`, `tokenHash` $\leftrightarrow$ DB: `author_id`, `token_hash` | Tầng TypeScript dùng camelCase, tầng PostgreSQL lưu trữ snake_case. |

---

### 1.2. Tiêu Chuẩn TypeScript & Chế Độ Nghiêm Ngặt (Strictness Standard)

Dự án bật chế độ `"strict": true` trong toàn bộ `tsconfig.json`. Mọi lập trình viên phải tuân thủ:

1. **Tuyệt Đối Không Dùng Kiểu `any`**:
   - Sử dụng `unknown` nếu chưa rõ kiểu dữ liệu ban đầu, sau đó dùng Type Narrowing hoặc Type Guards (`isAccessTokenPayload`) để ép kiểu an toàn.
   - Sử dụng `satisfies` hoặc Generics thay vì ép kiểu mù quáng (`as any`).
2. **Khai Báo Kiểu Trả Về Tường Minh Cho Public API**:
   - Mọi hàm trong `Service`, `Controller` và các API Callers (`postsApi`) phải khai báo kiểu trả về rõ ràng:
     ```typescript
     // ❌ SAI: Để TypeScript tự suy luận ngầm
     async getFeed(cursor?: string) { ... }

     // ✅ ĐÚNG: Khai báo tường minh Promise<CursorPage<PostItem>>
     async getFeed(cursor?: string | null): Promise<CursorPage<PostItem>> { ... }
     ```
3. **Quy Chuẩn Sắp Xếp Thứ Tự Import (Import Ordering)**:
   Mã nguồn trong mọi file phải được nhóm theo 4 tầng, phân cách bằng một dòng trống:
   ```typescript
   // 1. Node.js built-ins & external libraries
   import React, { useState, useEffect } from 'react';
   import { Injectable, NotFoundException } from '@nestjs/common';

   // 2. Internal core / infrastructure imports (Path Alias @/*)
   import { apiClient } from '@/lib/axios';
   import { PrismaService } from '@/prisma/prisma.service';

   // 3. Feature / Shared component imports
   import { Avatar } from '@/components/ui/Avatar';
   import { useAuth } from '@/features/auth/hooks/useAuth';

   // 4. Type-only imports (Luôn dùng cú pháp `import type`)
   import type { PostItem, Author } from '@/types/api';
   import type { CreatePostDto } from './dto/create-post.dto';
   ```

---

## 2. Quy Trình Git & Chuẩn Hóa Commit (Git Flow & Conventional Commits)

### 2.1. Chiến Lược Phân Nhánh (Git Branching Strategy)

Dự án áp dụng mô hình **Trunk-Based Development kết hợp Feature Branching** tinh gọn:

```mermaid
gitGraph
    commit id: "init"
    commit id: "feat(auth): login"
    branch feat/nested-threads
    checkout feat/nested-threads
    commit id: "feat(posts): thread-ui"
    commit id: "test(posts): thread-spec"
    checkout main
    merge feat/nested-threads id: "merge PR #12"
    branch fix/token-refresh-desync
    checkout fix/token-refresh-desync
    commit id: "fix(frontend): single-flight"
    checkout main
    merge fix/token-refresh-desync id: "merge PR #13"
    commit id: "release: v1.1.0" tag: "v1.1.0"
```

| Nhánh (Branch) | Quy ước đặt tên | Mục đích & Quy tắc |
| :--- | :--- | :--- |
| **`main`** | `main` | **Nhánh Chân Lý (Source of Truth)**. Luôn ở trạng thái có thể triển khai lên Production bất cứ lúc nào. Cấm commit trực tiếp lên `main` (bắt buộc qua PR). |
| **Tính năng mới** | `feat/<short-description>` | Ví dụ: `feat/nested-replies`, `feat/liked-posts`. Tách nhánh từ `main` và merge lại vào `main` qua PR. |
| **Sửa lỗi** | `fix/<short-description>` | Ví dụ: `fix/token-refresh-race`, `fix/socket-disconnect`. |
| **Tối ưu / Dọn dẹp** | `refactor/<short-description>` | Tái cấu trúc code mà không làm thay đổi hành vi nghiệp vụ. |
| **Hạ tầng / Devops** | `chore/<short-description>` | Nâng cấp package, sửa CI/CD workflow, cập nhật tài liệu. |

---

### 2.2. Chuẩn Commit Message (Conventional Commits 1.0.0)

Mọi commit message bắt buộc phải tuân theo quy chuẩn:

$$\text{<type>}(\text{<scope>}): \text{<subject>}$$

#### 1. Danh Mục Các `type` Hợp Lệ:
- `feat`: Tính năng mới cho người dùng (tương ứng với MINOR trong Semantic Versioning).
- `fix`: Sửa lỗi phát sinh trong hệ thống (tương ứng với PATCH).
- `refactor`: Tái cấu trúc mã nguồn không thêm tính năng và không sửa bug.
- `perf`: Cải thiện hiệu năng xử lý (tối ưu query, giảm re-render, nén ảnh).
- `test`: Thêm mới hoặc sửa đổi các bộ test suite.
- `docs`: Cập nhật tài liệu kỹ thuật, playdocs, README.
- `chore`: Thay đổi cấu hình build, cập nhật dependencies, linter.

#### 2. Danh Mục Các `scope` Chuẩn Của Dự Án:
- `(posts)`: Nghiệp vụ bài viết, thread, quote, repost, like.
- `(auth)`: Xác thực, session, JWT, OTP, đổi mật khẩu.
- `(users)`: Hồ sơ người dùng, quan hệ follow/unfollow.
- `(notifications)`: Hệ thống thông báo, listener.
- `(media)`: Cloudinary signatures, upload, nén file.
- `(social)`: Các tính năng xã hội tổng hợp (bảng tin, explore, liked).
- `(frontend)`: Giao diện người dùng, styles, component UI.
- `(backend)`: Hạ tầng server, Prisma, Fastify engine.

#### 3. Quy Tắc Viết Tiêu Đề (`subject`):
- Sử dụng thể mệnh lệnh ở thì hiện tại (Imperative mood): *"add"*, *"fix"*, *"align"*, *"refactor"* (không dùng *"added"*, *"fixing"*).
- Viết chữ thường toàn bộ, không viết hoa chữ cái đầu và **không có dấu chấm ở cuối câu**.
- Độ dài tối đa của dòng đầu tiên: **72 ký tự**.

*Ví dụ chuẩn từ lịch sử commit của dự án*:
```text
feat(social): add liked posts, infinite scrolling, and shared navigation
fix(posts): show nested replies within post threads
feat(frontend): redesign social dashboard and auth pages with pastel ui
fix(frontend): share session refresh across startup and 401 requests
fix(backend): align Prisma timestamps and row counts, and disconnect revoked sockets
```

---

### 2.3. Quy Chuẩn Pull Request & Tiêu Chí Kiểm Duyệt (Code Review Checklist)

Một Pull Request (PR) chỉ được phép hòa mạng vào nhánh `main` khi vượt qua **Cổng Kiểm Soát Chất Lượng (Quality Gate)**:

- [ ] **Tiêu đề PR**: Tuân thủ đúng định dạng Conventional Commits.
- [ ] **Build & Linting**: Lệnh `npm run lint` chạy không có bất kỳ Warning hay Error nào.
- [ ] **Kiểm thử tự động**: Toàn bộ unit/integration test trong `npm test` đều Passed 100%.
- [ ] **Không sót mã debug**: Tuyệt đối không còn `console.log`, `debugger`, `TODO: temp` hoặc file nháp.
- [ ] **Bảo vệ ranh giới (Boundaries)**: Frontend không import code backend; Controller giữ siêu mỏng; Service không truy cập chéo private repository của module khác.
- [ ] **Attribution**: Tuân thủ chữ ký Co-Authored-By khi sử dụng công cụ AI hỗ trợ.

---

## 3. Chuẩn Trả Lỗi & Phản Hồi API (API Response & Error Contract)

Để Frontend và Backend có thể tích hợp mượt mà và tự động hóa việc bắt lỗi, toàn bộ các HTTP endpoint phải tuân thủ hợp đồng dữ liệu chuẩn hóa:

### 3.1. Cấu Trúc Phản Hồi Thành Công (Success Envelopes)

1. **Phản Hồi Thực Thể Đơn (Single Entity)**:
   - Trả trực tiếp Object dữ liệu (hoặc bọc trong DTO) với mã HTTP `200 OK` hoặc `201 Created`:
   ```json
   {
     "id": "cm3a9b1c2000008l0h9x0abc1",
     "content": "Chào mừng bạn đến với mạng xã hội MXH!",
     "visibility": "PUBLIC",
     "createdAt": "2026-10-27T08:00:00.000Z",
     "author": {
       "id": "cm3a9b1c2000008l0h9x0abc0",
       "username": "minhthu",
       "displayName": "Minh Thư",
       "avatarUrl": "https://res.cloudinary.com/mxh/image/upload/v1/avatar.webp"
     },
     "counters": {
       "likeCount": 12,
       "replyCount": 3,
       "repostCount": 1,
       "quoteCount": 0,
       "bookmarkCount": 5
     },
     "interactions": {
       "isLiked": false,
       "isReposted": false,
       "isBookmarked": true
     }
   }
   ```
2. **Phản Hồi Danh Sách Phân Trang Bằng Con Trỏ (`CursorPage<T>`)**:
   - Sử dụng cho Feed, Khám phá, Bình luận (Infinite Scrolling):
   ```json
   {
     "items": [ /* Danh sách các PostItem / UserItem */ ],
     "nextCursor": "cm3a9b1c2000008l0h9x0xyz9"
   }
   ```
   *(Nếu không còn trang tiếp theo, `nextCursor` sẽ là `null`)*.

---

### 3.2. Cấu Trúc Phản Hồi Lỗi Chuẩn Hóa (Unified Error Envelope)

Khi có bất kỳ lỗi nào phát sinh (từ validation, logic nghiệp vụ, đến ngoại lệ hệ thống), `AllExceptionsFilter` đảm bảo trả về định dạng JSON thống nhất sau:

```json
{
  "success": false,
  "statusCode": 400,
  "code": "VALIDATION_FAILED",
  "message": "Dữ liệu không hợp lệ",
  "errors": [
    "Nội dung bài viết không được vượt quá 2000 ký tự",
    "Chỉ chấp nhận các giá trị: PUBLIC, FOLLOWERS, PRIVATE"
  ],
  "requestId": "cm3a9b1c2000008l0h9x0abc1",
  "path": "/api/v1/posts",
  "timestamp": "2026-10-27T10:15:30.123Z"
}
```

### 3.3. Bảng Ánh Xạ Mã Trạng Thái HTTP & Mã Lỗi Máy Đọc Được

| HTTP Status | Ý nghĩa chuẩn | Khi nào sử dụng trong dự án | `code` máy đọc được (Machine-Readable Codes) |
| :--- | :--- | :--- | :--- |
| **`200 OK`** | Thành công | Truy vấn dữ liệu thành công (GET), cập nhật thành công (PUT/PATCH), hoặc thao tác xoay vòng token. | Không áp dụng |
| **`201 Created`** | Tạo mới thành công | Đăng ký tài khoản, tạo bài viết mới, gửi yêu cầu kết nối. | Không áp dụng |
| **`204 No Content`** | Thành công không body | Xóa bài viết, bỏ thích (Unlike), bỏ lưu (Unbookmark). | Không áp dụng |
| **`400 Bad Request`** | Dữ liệu sai cú pháp | Lỗi Validation Pipe (thiếu trường, sai format, vượt quá 2000 ký tự), chữ ký Cloudinary giả mạo. | `VALIDATION_FAILED`<br/>`MEDIA_INVALID_SIGNATURE`<br/>`INVALID_POST_STATE` |
| **`401 Unauthorized`** | Chưa định danh | Không có JWT token, token hết hạn, phiên bị thu hồi (`isRevoked = true`), sai email/mật khẩu khi login. | `AUTH_INVALID_CREDENTIALS`<br/>`AUTH_TOKEN_EXPIRED`<br/>`AUTH_SESSION_REVOKED` |
| **`403 Forbidden`** | Không có quyền | Cố tình xóa/sửa bài viết của người khác, tài khoản chưa xác thực email OTP, tài khoản bị khóa (`isActive = false`). | `AUTH_ACCOUNT_LOCKED`<br/>`AUTH_EMAIL_UNVERIFIED`<br/>`POST_FORBIDDEN_ACTION` |
| **`404 Not Found`** | Không tìm thấy | ID bài viết không tồn tại, người dùng `@username` không tồn tại trong hệ thống. | `POST_NOT_FOUND`<br/>`USER_NOT_FOUND` |
| **`409 Conflict`** | Xung đột tài nguyên | Đăng ký email/username đã tồn tại, Repost thuần 2 lần trên cùng một bài viết. | `AUTH_EMAIL_CONFLICT`<br/>`AUTH_USERNAME_CONFLICT`<br/>`POST_ALREADY_REPOSTED` |
| **`429 Too Many Requests`** | Vượt ngưỡng tần suất | Người dùng gửi quá 10 lượt OTP/phút hoặc spam đăng bài quá 30 req/phút. | `RATE_LIMIT_EXCEEDED` |
| **`500 Internal Error`** | Lỗi máy chủ | Lỗi cơ sở dữ liệu không mong muốn, crash tiến trình. Luôn ẩn stack trace trên production. | `INTERNAL_SERVER_ERROR` |

---

## 4. Quy Chuẩn Kiểm Thử & Đảm Bảo Chất Lượng (Testing & Quality Gates)

### 4.1. Phân Tầng Kiểm Thử & Quy Ước Đặt Tên File Test

Dự án áp dụng mô hình **Colocation Testing** (Đặt tệp kiểm thử nằm ngay cạnh tệp mã nguồn tương ứng) để dễ quản lý và bảo trì:

```text
backend/src/posts/
├── posts.controller.ts
├── posts.service.ts
└── posts.service.test.ts        # Unit & Integration test cho PostsService
frontend/lib/
├── single-flight.ts
└── single-flight.test.ts        # Test cho thuật toán gộp request Single-Flight
```

- Quy ước tên file: `*.test.ts` hoặc `*.spec.ts`.
- Mọi logic cốt lõi (Authentication, Token Refresh, Post Hierarchy, Search Parser, Single-Flight, Reconcilers) **bắt buộc phải có bài kiểm thử tự động**.

### 4.2. Bảng Lệnh Thực Thi Test Suite

| Lệnh thực thi | Phạm vi kiểm thử | Mục đích |
| :--- | :--- | :--- |
| **`npm test`** *(Root)* | Toàn bộ monorepo | Chạy toàn bộ test suites của cả Backend và Frontend qua Turborepo. |
| **`npm run test:auth`** *(Backend)* | `src/auth/*.test.ts` | Kiểm thử đăng ký, đăng nhập, cấp phát JWT, băm mật khẩu Argon2 và xoay vòng Session. |
| **`npm run test:posts`** *(Backend)* | `src/posts/*.test.ts` | Kiểm thử tạo bài, reply nhiều tầng, quote post, cascade delete và kiểm toán bộ đếm. |
| **`npm run test:gateway`** *(Backend)* | `src/gateway/*.test.ts` | Kiểm thử kết nối WebSocket, gia nhập phòng `user:id`, và ngắt kết nối khi revoke phiên. |
| **`npm run test:notifications`** | `src/notifications/*.test.ts` | Kiểm thử lắng nghe domain event, chống spam trùng lặp thông báo. |
| **`npm test`** *(Frontend)* | `lib/**/*.test.ts`, `features/**/*.test.ts` | Kiểm thử Single-Flight Axios, Navigation state, format thời gian và xử lý lỗi API. |

---

## 5. Bảo Mật & Quản Trị Bí Mật (Security & Secret Management)

### 5.1. Quy Tắc Quản Lý Biến Môi Trường (Zero Secrets in Git)

1. **Nghiêm Cấm Commit File `.env`**:
   - File `.env`, `.env.local`, `.env.production` **tuyệt đối không bao giờ** được commit vào Git repository (đã được cấu hình nghiêm ngặt trong `.gitignore`).
2. **Duy Trì `.env.example` Luôn Đồng Bộ**:
   - Bất kỳ khi nào một tính năng mới cần thêm biến môi trường (ví dụ: cấu hình Cloudinary mới, API Key mới), lập trình viên **phải cập nhật ngay** vào `backend/.env.example` hoặc `frontend/.env.example` với giá trị placeholder mô tả rõ ràng:
     ```env
     # backend/.env.example
     DATABASE_URL="postgresql://user:password@localhost:5432/mxh_db"
     JWT_ACCESS_SECRET="your-super-secret-access-key-min-32-chars"
     JWT_REFRESH_SECRET="your-super-secret-refresh-key-min-32-chars"
     CLOUDINARY_CLOUD_NAME="your-cloud-name"
     CLOUDINARY_API_KEY="your-api-key"
     CLOUDINARY_API_SECRET="your-api-secret"
     COOKIE_SECRET="cookie-signing-secret"
     CORS_ORIGIN="http://localhost:3000"
     ```

### 5.2. Các Lớp Phòng Thủ Bảo Mật Ứng Dụng (Application Defense Standards)

1. **Chống Tấn Công Tấn Công Mass Assignment**:
   - Backend cấu hình toàn cục `ValidationPipe`:
     ```typescript
     new ValidationPipe({
       whitelist: true,            // Tự động loại bỏ mọi field thừa không khai báo trong DTO
       forbidNonWhitelisted: true, // Quăng lỗi ngay lập tức nếu client cố tình gửi trường lạ
       transform: true,            // Ép kiểu tự động
     })
     ```
2. **Chống Injection & Rò Rỉ Dữ Liệu**:
   - Mọi câu lệnh truy vấn dữ liệu phải sử dụng **Prisma ORM Parameterized Queries**. Tuyệt đối không bao giờ nối chuỗi thô (`string concatenation`) vào câu lệnh SQL.
3. **Bảo Vệ Cookie & Chống Tấn Công CSRF**:
   - Refresh Token bắt buộc phải lưu trong Cookie với đầy đủ các thuộc tính:
     * `httpOnly: true`: Ngăn chặn JavaScript độc hại đọc trộm token qua tấn công XSS.
     * `secure: process.env.NODE_ENV === 'production'`: Chỉ truyền qua kênh mã hóa HTTPS.
     * `sameSite: 'lax'`: Ngăn chặn tấn công giả mạo yêu cầu từ trang khác (CSRF).
     * `signed: true`: Ký cookie bằng `COOKIE_SECRET` chống việc client tự ý sửa đổi giá trị.
4. **Chống Tấn Công Dò Quét & Thao Túng Tài Nguyên (IDOR Defense)**:
   - Sử dụng định danh **CUIDv2** thay vì số nguyên tăng dần `1, 2, 3`.
   - Mọi thao tác sửa/xóa luôn đối chiếu quyền sở hữu dựa trên danh tính người dùng trích xuất từ JWT token giải mã (`@CurrentUser('sub')`), tuyệt đối không tin tưởng bất kỳ ID nào gửi từ body của client.
