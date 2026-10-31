import {HttpStatus, Injectable, UnauthorizedException} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import { Inject, forwardRef } from '@nestjs/common';
import { UsersService } from '../users/users.service.js';
import type {CurrentUserPayload} from './decorators/current-user.decorator.js';
import { DomainException, ERROR_CODES } from '../common/exceptions/domain.exception.js';

@Injectable()
export class AccessSessionService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(forwardRef(() => UsersService)) private readonly usersService: UsersService,
  ) {}

  async verifyAccessToken(token: string): Promise<CurrentUserPayload> {
    let payload: unknown;

    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
    } catch (error) {
      const code = error instanceof Error && error.name === 'TokenExpiredError'
        ? ERROR_CODES.AUTH_TOKEN_EXPIRED
        : ERROR_CODES.AUTH_UNAUTHORIZED;
      throw new DomainException(code, 'Token không hợp lệ hoặc đã hết hạn', HttpStatus.UNAUTHORIZED);
    }

    if (!this.isAccessTokenPayload(payload)) {
      throw new UnauthorizedException('Token không chứa thông tin phiên hợp lệ');
    }

    const session = await this.usersService.getAccessSessionState(payload.sessionId);

    if (!session || session.userId !== payload.sub) {
      throw new DomainException(ERROR_CODES.AUTH_SESSION_EXPIRED, 'Phiên đăng nhập không còn hiệu lực', HttpStatus.UNAUTHORIZED);
    }
    if (session.isRevoked) {
      throw new DomainException(ERROR_CODES.AUTH_SESSION_REVOKED, 'Phiên đăng nhập đã bị thu hồi', HttpStatus.UNAUTHORIZED);
    }
    if (this.isExpired(session.expiresAt)) {
      throw new DomainException(ERROR_CODES.AUTH_SESSION_EXPIRED, 'Phiên đăng nhập đã hết hạn', HttpStatus.UNAUTHORIZED);
    }
    if (!session.isActive) {
      throw new DomainException(ERROR_CODES.AUTH_ACCOUNT_LOCKED, 'Tài khoản đã bị khóa', HttpStatus.FORBIDDEN);
    }
    if (!session.isEmailVerified) {
      throw new DomainException(ERROR_CODES.AUTH_EMAIL_UNVERIFIED, 'Tài khoản chưa xác thực email', HttpStatus.FORBIDDEN);
    }

    return payload;
  }

  private isAccessTokenPayload(payload: unknown): payload is CurrentUserPayload {
    if (typeof payload !== 'object' || payload === null) return false;

    const candidate = payload as Record<string, unknown>;
    return (
      typeof candidate.sub === 'string' &&
      typeof candidate.email === 'string' &&
      typeof candidate.username === 'string' &&
      typeof candidate.sessionId === 'string'
    );
  }

  private isExpired(expiresAt: unknown): boolean {
    if (expiresAt && typeof expiresAt === 'object' && 'epochMilliseconds' in expiresAt) {
      return Date.now() > Number((expiresAt as {epochMilliseconds: number}).epochMilliseconds);
    }

    if (expiresAt instanceof Date) {
      return Date.now() > expiresAt.getTime();
    }

    const timestamp = new Date(expiresAt as string).getTime();
    return !Number.isFinite(timestamp) || Date.now() > timestamp;
  }
}
