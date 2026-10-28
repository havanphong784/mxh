import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * Danh mục mã lỗi máy đọc được (Machine-Readable Error Codes)
 * Khớp chuẩn quy định tại docs/02-backend-db.md và docs/04-conventions.md
 */
export const ERROR_CODES = {
  // Xác thực & Phân quyền
  AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
  AUTH_ACCOUNT_LOCKED: "AUTH_ACCOUNT_LOCKED",
  AUTH_EMAIL_UNVERIFIED: "AUTH_EMAIL_UNVERIFIED",
  AUTH_SESSION_EXPIRED: "AUTH_SESSION_EXPIRED",
  AUTH_SESSION_REVOKED: "AUTH_SESSION_REVOKED",
  AUTH_UNAUTHORIZED: "AUTH_UNAUTHORIZED",
  FORBIDDEN_ACTION: "FORBIDDEN_ACTION",

  // Bài viết
  POST_NOT_FOUND: "POST_NOT_FOUND",
  POST_FORBIDDEN_ACTION: "POST_FORBIDDEN_ACTION",
  POST_ALREADY_REPOSTED: "POST_ALREADY_REPOSTED",
  INVALID_POST_STATE: "INVALID_POST_STATE",

  // Người dùng
  USER_NOT_FOUND: "USER_NOT_FOUND",
  USER_ALREADY_FOLLOWED: "USER_ALREADY_FOLLOWED",

  // Media & Dữ liệu
  MEDIA_INVALID_SIGNATURE: "MEDIA_INVALID_SIGNATURE",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/**
 * DomainException: Exception cơ sở cho các lỗi nghiệp vụ mang danh tính
 */
export class DomainException extends HttpException {
  constructor(
    public readonly code: ErrorCode | string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly errors: string[] | null = null,
  ) {
    super({ code, message, errors }, status);
  }
}
