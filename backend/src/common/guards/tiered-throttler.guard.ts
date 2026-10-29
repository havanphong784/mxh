import { Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import {
  getOptionsToken,
  getStorageToken,
  ThrottlerGuard,
  ThrottlerStorage,
} from "@nestjs/throttler";
import type { ThrottlerModuleOptions } from "@nestjs/throttler";

/**
 * TieredThrottlerGuard
 * Triển khai phân tầng giới hạn tần suất (Tiered Rate Limiting) theo docs/02-backend-db.md:
 * - Đối với client đã xác thực (request.user hoặc Bearer Token đã xác minh chữ ký): Phân tầng theo User / Phiên (20-30 req/min cho Write, 100-200 req/min cho Read)
 * - Đối với client chưa xác thực (Auth endpoints): Phân tầng theo Client IP (5-10 req/min cho Auth)
 */
@Injectable()
export class TieredThrottlerGuard extends ThrottlerGuard {
  constructor(
    @Inject(getOptionsToken()) options: ThrottlerModuleOptions,
    @Inject(getStorageToken()) storage: ThrottlerStorage,
    reflector: Reflector,
    private readonly jwtService: JwtService,
  ) {
    super(options, storage, reflector);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    if (req.user?.sub) {
      return `user:${req.user.sub}`;
    }

    const authHeader = req.headers?.authorization;
    if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
      try {
        const payload: unknown = await this.jwtService.verifyAsync(authHeader.slice(7), {
          secret: process.env.JWT_ACCESS_SECRET,
        });
        if (payload && typeof payload === "object" && "sub" in payload && typeof payload.sub === "string") {
          return `user:${payload.sub}`;
        }
      } catch {
        // Invalid tokens remain subject to the caller's IP limit.
      }
    }

    const ip =
      req.ips?.[0] ?? req.ip ?? req.socket?.remoteAddress ?? "127.0.0.1";
    return `ip:${ip}`;
  }
}
