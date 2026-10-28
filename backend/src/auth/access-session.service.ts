import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../prisma/prisma.service.js";
import type { CurrentUserPayload } from "./decorators/current-user.decorator.js";
import type { EnvironmentVariables } from "../config/env.validation.js";

@Injectable()
export class AccessSessionService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  async verifyAccessToken(token: string): Promise<CurrentUserPayload> {
    let payload: unknown;

    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get("JWT_ACCESS_SECRET", { infer: true }),
      });
    } catch {
      throw new UnauthorizedException("Token không hợp lệ hoặc đã hết hạn");
    }

    if (!this.isAccessTokenPayload(payload)) {
      throw new UnauthorizedException(
        "Token không chứa thông tin phiên hợp lệ",
      );
    }

    const session = await this.prisma.client.orm.public.Session.where((s) =>
      s.id.eq(payload.sessionId),
    )
      .include("user")
      .first();

    if (
      !session ||
      session.userId !== payload.sub ||
      session.isRevoked ||
      this.isExpired(session.expiresAt) ||
      !session.user.isActive ||
      !session.user.isEmailVerified
    ) {
      throw new UnauthorizedException("Phiên đăng nhập không còn hiệu lực");
    }

    return payload;
  }

  private isAccessTokenPayload(
    payload: unknown,
  ): payload is CurrentUserPayload {
    if (typeof payload !== "object" || payload === null) return false;

    const candidate = payload as Record<string, unknown>;
    return (
      typeof candidate.sub === "string" &&
      typeof candidate.email === "string" &&
      typeof candidate.username === "string" &&
      typeof candidate.sessionId === "string"
    );
  }

  private isExpired(expiresAt: unknown): boolean {
    if (
      expiresAt &&
      typeof expiresAt === "object" &&
      "epochMilliseconds" in expiresAt
    ) {
      return (
        Date.now() >
        Number((expiresAt as { epochMilliseconds: number }).epochMilliseconds)
      );
    }

    if (expiresAt instanceof Date) {
      return Date.now() > expiresAt.getTime();
    }

    const timestamp = new Date(expiresAt as string).getTime();
    return !Number.isFinite(timestamp) || Date.now() > timestamp;
  }
}
