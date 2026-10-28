import { Injectable } from "@nestjs/common";
import { ThrottlerGuard } from "@nestjs/throttler";

/**
 * TieredThrottlerGuard
 * Triển khai phân tầng giới hạn tần suất (Tiered Rate Limiting) theo docs/02-backend-db.md:
 * - Đối với client đã xác thực (có Bearer Token hoặc request.user): Phân tầng theo User / Phiên (20-30 req/min cho Write, 100-200 req/min cho Read)
 * - Đối với client chưa xác thực (Auth endpoints): Phân tầng theo Client IP (5-10 req/min cho Auth)
 */
@Injectable()
export class TieredThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (req.user?.sub) {
      return `user:${req.user.sub}`;
    }

    const authHeader = req.headers?.authorization;
    if (
      authHeader &&
      typeof authHeader === "string" &&
      authHeader.startsWith("Bearer ")
    ) {
      return `user:${authHeader.slice(7, 40)}`;
    }

    const ip =
      req.ips?.[0] ?? req.ip ?? req.socket?.remoteAddress ?? "127.0.0.1";
    return `ip:${ip}`;
  }
}
