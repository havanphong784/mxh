import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, of } from "rxjs";
import { tap } from "rxjs/operators";
import type { FastifyReply, FastifyRequest } from "fastify";
import { IdempotencyService } from "./idempotency.service.js";
import {
  DomainException,
  ERROR_CODES,
} from "../exceptions/domain.exception.js";

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    // 1. Chỉ áp dụng cho các HTTP methods mang tính thay đổi trạng thái (Mutations)
    const method = request.method?.toUpperCase();
    if (
      method !== "POST" &&
      method !== "PUT" &&
      method !== "PATCH" &&
      method !== "DELETE"
    ) {
      return next.handle();
    }

    // 2. Kiểm tra sự hiện diện của header Idempotency-Key
    const rawKey = request.headers["idempotency-key"];
    if (!rawKey || typeof rawKey !== "string" || rawKey.trim().length === 0) {
      return next.handle();
    }

    const sanitizedKey = rawKey.trim();
    if (sanitizedKey.length > 128) {
      throw new DomainException(
        ERROR_CODES.VALIDATION_FAILED,
        "Idempotency-Key vượt quá độ dài tối đa cho phép (128 ký tự)",
        HttpStatus.BAD_REQUEST,
      );
    }

    // Scope key theo user ID (nếu đã xác thực) hoặc theo IP
    const user = (request as unknown as { user?: { sub?: string; id?: string } })
      .user;
    const scope = user?.sub || user?.id || request.ip || "anonymous";
    const scopedKey = `${scope}:${sanitizedKey}`;

    // 3. Kiểm tra trạng thái trong bộ đệm idempotency
    const existing = this.idempotencyService.get(scopedKey);
    if (existing) {
      if (existing.status === "IN_FLIGHT") {
        throw new DomainException(
          ERROR_CODES.IDEMPOTENT_OPERATION_IN_PROGRESS,
          "Yêu cầu tương ứng với Idempotency-Key này đang được xử lý, vui lòng không gửi lại liên tục",
          HttpStatus.CONFLICT,
        );
      }

      if (existing.status === "COMPLETED") {
        if (reply.header) {
          reply.header("x-idempotent-replay", "true");
        }
        if (existing.statusCode && reply.status) {
          reply.status(existing.statusCode);
        }
        return of(existing.body);
      }
    }

    // 4. Đánh dấu key đang được thực thi (IN_FLIGHT)
    this.idempotencyService.setInFlight(scopedKey);

    return next.handle().pipe(
      tap({
        next: (body) => {
          const statusCode =
            reply.statusCode ||
            (method === "POST" ? HttpStatus.CREATED : HttpStatus.OK);
          this.idempotencyService.setCompleted(scopedKey, statusCode, body);
        },
        error: () => {
          // Khi phát sinh lỗi, hủy key để client có thể sửa input và gửi lại
          this.idempotencyService.delete(scopedKey);
        },
      }),
    );
  }
}
