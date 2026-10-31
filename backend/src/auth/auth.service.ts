import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  UnauthorizedException,
} from "@nestjs/common";
import { UsersService } from "../users/users.service.js";
import { UsersAuthService } from "../users/users-auth.service.js";
import argon2 from "argon2";
import * as crypto from "node:crypto";
import { MailService } from "../mail/mail.service.js";
import { RegisterDto } from "./dto/register.dto.js";
import { VerifyOtpDto } from "./dto/verify-otp.dto.js";
import { JwtService } from "@nestjs/jwt";
import { ResendOtpDto } from "./dto/resend-otp.dto.js";
import { LoginDto } from "./dto/login.dto.js";
import { ForgotPasswordDto } from "./dto/forgot-password.dto.js";
import { ResetPasswordDto } from "./dto/reset-password.dto.js";
import { Temporal } from "@js-temporal/polyfill";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AUTH_EVENTS } from "../events/event-types.js";
import {
  DomainException,
  ERROR_CODES,
} from "../common/exceptions/domain.exception.js";
import type {
  SessionRevokedEvent,
  UserSessionsRevokedEvent,
} from "../events/event-types.js";
import type {
  AuthResultDto,
  AuthUserDto,
  MessageResponseDto,
  RefreshResultDto,
  RegisterResponseDto,
} from "./dto/auth-response.dto.js";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "../config/env.validation.js";

export interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly mailService: MailService,
    private readonly jwtService: JwtService,
    private readonly eventEmitter: EventEmitter2,
    @Inject(forwardRef(() => UsersService))
    private readonly usersService: UsersService,
    private readonly usersAuthService: UsersAuthService,
    private readonly configService?: ConfigService<EnvironmentVariables, true>,
  ) {}

  async getMe(userId: string): Promise<AuthUserDto> {
    return this.usersService.getAuthProfile(userId);
  }

  async register(dto: RegisterDto): Promise<RegisterResponseDto> {
    const email = dto.email;
    const username = dto.username;

    const existingEmail = await this.usersAuthService.findUserByEmail(email);
    if (existingEmail) {
      if (!existingEmail.isEmailVerified) {
        throw new DomainException(
          ERROR_CODES.AUTH_EMAIL_CONFLICT,
          "Email này đã được đăng ký nhưng chưa được kích hoạt. Vui lòng xác thực tài khoản.",
          HttpStatus.CONFLICT,
        );
      }
      throw new DomainException(
        ERROR_CODES.AUTH_EMAIL_CONFLICT,
        "Email đã tồn tại !",
        HttpStatus.CONFLICT,
      );
    }

    const existingUsername =
      await this.usersAuthService.usernameExists(username);
    if (existingUsername) {
      throw new DomainException(
        ERROR_CODES.AUTH_USERNAME_CONFLICT,
        "Username đã tồn tại !",
        HttpStatus.CONFLICT,
      );
    }

    const passwordHash = await argon2.hash(dto.password);
    const otpCode = this.generateOtpCode();
    const codeHash = this.hashSha256(otpCode);
    const expiresAt = Temporal.Instant.fromEpochMilliseconds(
      Date.now() + 5 * 60 * 1000, // 5 phút
    );

    const user = await this.usersAuthService.createPendingUserWithOtp({
      email,
      username,
      passwordHash,
      displayName: dto.displayName,
      codeHash,
      expiresAt,
    });

    const isSent = await this.mailService.sendOtpEmail(user.email, otpCode);
    if (!isSent) {
      await this.usersAuthService.deleteUserById(user.id);
      throw new BadRequestException(
        "Hệ thống tạm thời không thể gửi email xác thực. Vui lòng kiểm tra lại địa chỉ email hoặc thử lại sau.",
      );
    }

    return {
      message:
        "Đăng ký tài khoản thành công! Vui lòng kiểm tra email để nhận mã xác thực.",
      email: user.email,
    };
  }

  async verifyOtp(
    dto: VerifyOtpDto,
    meta: RequestMeta,
  ): Promise<AuthResultDto> {
    const email = dto.email;
    const otpRecord = await this.usersAuthService.findLatestOtp(
      email,
      "REGISTER_VERIFY",
    );
    if (!otpRecord) {
      throw new NotFoundException(
        "Không tìm thấy yêu cầu xác thực hoặc mã đã hết hạn",
      );
    }

    if (otpRecord.attempts >= 5) {
      throw new ForbiddenException(
        "Bạn đã vượt quá số lần thử tối đa. Vui lòng yêu cầu mã OTP mới.",
      );
    }

    const expiresAtMs = this.getTimestampMs(otpRecord.expiresAt);
    if (Date.now() > expiresAtMs) {
      throw new BadRequestException(
        "Mã OTP đã hết hiệu lực. Vui lòng lấy mã mới.",
      );
    }

    const inputHash = this.hashSha256(dto.code);
    if (inputHash !== otpRecord.codeHash) {
      await this.usersAuthService.incrementOtpAttempts(
        otpRecord.id,
        otpRecord.attempts + 1,
      );
      throw new BadRequestException("Mã OTP không chính xác");
    }

    const user = await this.usersAuthService.findUserByEmail(email);

    if (!user) {
      throw new NotFoundException("Không tìm thấy thông tin người dùng");
    }

    const refreshToken = await this.generateRefreshToken(user.id);
    const sessionData = this.createSessionData(user.id, refreshToken, meta);
    const session = await this.usersAuthService.activateAndCreateSession(
      email,
      otpRecord.id,
      sessionData,
    );

    const accessToken = await this.generateAccessToken(user, session.id);

    return {
      message: "Kích hoạt tài khoản thành công!",
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bannerUrl: user.bannerUrl,
        bio: user.bio,
        isEmailVerified: true,
        createdAt: user.createdAt,
      },
    };
  }

  async resendOtp(dto: ResendOtpDto): Promise<RegisterResponseDto> {
    const email = dto.email;
    const user = await this.usersAuthService.findUserByEmail(email);
    if (!user) {
      throw new NotFoundException("Không tìm thấy tài khoản với email này.");
    }

    if (user.isEmailVerified) {
      throw new BadRequestException(
        "Tài khoản này đã được kích hoạt trước đó. Vui lòng đăng nhập.",
      );
    }

    const lastOtp = await this.usersAuthService.findLatestOtp(
      email,
      "REGISTER_VERIFY",
    );

    if (lastOtp) {
      const createdAtMs = this.getTimestampMs(lastOtp.createdAt);
      const diffMs = Date.now() - createdAtMs;
      const cooldownMs = 60 * 1000;

      if (diffMs < cooldownMs) {
        const waitSeconds = Math.ceil((cooldownMs - diffMs) / 1000);
        throw new BadRequestException(
          `Vui lòng chờ ${waitSeconds} giây nữa trước khi yêu cầu mã mới.`,
        );
      }

      await this.usersAuthService.deleteOtp(lastOtp.id);
    }

    const otpCode = this.generateOtpCode();
    const codeHash = this.hashSha256(otpCode);
    const expiresAt = Temporal.Instant.fromEpochMilliseconds(
      Date.now() + 5 * 60 * 1000, // 5 phút
    );

    const createdOtp = await this.usersAuthService.createOtp({
      email: user.email,
      codeHash,
      type: "REGISTER_VERIFY",
      expiresAt,
      attempts: 0,
      userId: user.id,
    });

    const isSent = await this.mailService.sendOtpEmail(user.email, otpCode);
    if (!isSent) {
      await this.usersAuthService.deleteOtp(createdOtp.id);
      throw new BadRequestException(
        "Hệ thống tạm thời không thể gửi email xác thực. Vui lòng thử lại sau.",
      );
    }

    return {
      email: user.email,
      message: "Mã xác thực mới đã được gửi vào email của bạn",
    };
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResultDto> {
    const email = dto.email;
    const user = await this.usersAuthService.findUserByEmail(email);

    if (!user) {
      throw new DomainException(
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        "Email hoặc mật khẩu không chính xác.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!user.isActive) {
      throw new DomainException(
        ERROR_CODES.AUTH_ACCOUNT_LOCKED,
        "Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.",
        HttpStatus.FORBIDDEN,
      );
    }

    if (!user.isEmailVerified) {
      throw new DomainException(
        ERROR_CODES.AUTH_EMAIL_UNVERIFIED,
        "Tài khoản chưa được kích hoạt. Vui lòng xác thực email trước khi đăng nhập.",
        HttpStatus.FORBIDDEN,
      );
    }

    const isPasswordValid = await this.usersAuthService.verifyPassword(
      email,
      dto.password,
    );
    if (!isPasswordValid) {
      throw new DomainException(
        ERROR_CODES.AUTH_INVALID_CREDENTIALS,
        "Email hoặc mật khẩu không chính xác.",
        HttpStatus.UNAUTHORIZED,
      );
    }

    const refreshToken = await this.generateRefreshToken(user.id);
    const session = await this.createSession(user.id, refreshToken, meta);
    const accessToken = await this.generateAccessToken(user, session.id);

    return {
      message: "Đăng nhập thành công!",
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bannerUrl: user.bannerUrl,
        bio: user.bio,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
      },
    };
  }

  async refreshTokens(
    refreshToken: string,
    meta: RequestMeta,
  ): Promise<RefreshResultDto> {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, {
        secret:
          this.configService?.get("JWT_REFRESH_SECRET", { infer: true }) ??
          process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException(
        "Refresh token không hợp lệ hoặc đã hết hạn.",
      );
    }

    const tokenHash = this.hashSha256(refreshToken);
    const session =
      await this.usersAuthService.findSessionByTokenHash(tokenHash);

    if (!session) {
      throw new UnauthorizedException(
        "Phiên đăng nhập không tồn tại hoặc đã bị đăng xuất.",
      );
    }

    if (session.isRevoked) {
      const revokedAtMs = this.getTimestampMs(session.updatedAt);
      const GRACE_PERIOD_MS = 20 * 1000;
      const timeSinceRevoked = Date.now() - revokedAtMs;

      if (timeSinceRevoked <= GRACE_PERIOD_MS) {
        // Request refresh trùng có thể đến do nhiều tab hoặc request đồng thời.
        // Token cũ đã bị rotate nên tuyệt đối không tái cấp session từ token này.
        // Chỉ trả 401 trong grace period để không thu hồi nhầm các phiên hợp lệ khác.
        throw new UnauthorizedException(
          "Phiên đăng nhập vừa được làm mới, vui lòng thử lại với token mới.",
        );
      }

      await this.usersAuthService.revokeSessionsForUser(session.userId);

      this.eventEmitter.emit(AUTH_EVENTS.USER_SESSIONS_REVOKED, {
        userId: session.userId,
      } satisfies UserSessionsRevokedEvent);

      throw new ForbiddenException(
        "Phát hiện dấu hiệu bất thường. Toàn bộ phiên đăng nhập đã bị hủy, vui lòng đăng nhập lại.",
      );
    }

    const expiresAtMs = this.getTimestampMs(session.expiresAt);
    if (Date.now() > expiresAtMs) {
      throw new UnauthorizedException("Phiên đăng nhập đã hết hạn.");
    }

    const user = await this.usersAuthService.findUserById(session.userId);

    if (!user || !user.isActive) {
      throw new UnauthorizedException(
        "Tài khoản không tồn tại hoặc đã bị khóa.",
      );
    }

    const newRefreshToken = await this.generateRefreshToken(user.id);
    const newSessionData = this.createSessionData(
      user.id,
      newRefreshToken,
      meta,
    );
    const newSession = await this.usersAuthService.rotateRefreshSession(
      session.id,
      newSessionData,
    );
    if (!newSession) {
      throw new UnauthorizedException(
        "Phiên đăng nhập vừa được làm mới, vui lòng thử lại với token mới.",
      );
    }

    this.eventEmitter.emit(AUTH_EVENTS.SESSION_REVOKED, {
      sessionId: session.id,
    } satisfies SessionRevokedEvent);

    const newAccessToken = await this.generateAccessToken(user, newSession.id);
    return {
      message: "Làm mới phiên đăng nhập thành công!",
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken?: string): Promise<MessageResponseDto> {
    if (!refreshToken) {
      return { message: "Đăng xuất thành công!" };
    }

    const tokenHash = this.hashSha256(refreshToken);

    const sessionIds =
      await this.usersAuthService.revokeSessionByTokenHash(tokenHash);

    for (const sessionId of sessionIds) {
      this.eventEmitter.emit(AUTH_EVENTS.SESSION_REVOKED, {
        sessionId,
      } satisfies SessionRevokedEvent);
    }

    return {
      message: "Đăng xuất thành công!",
    };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<MessageResponseDto> {
    const email = dto.email;
    const user = await this.usersAuthService.findUserByEmail(email);

    if (!user || !user.isActive) {
      return {
        message:
          "Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã OTP đặt lại mật khẩu.",
      };
    }

    const lastOtp = await this.usersAuthService.findLatestOtp(
      email,
      "FORGOT_PASSWORD",
    );

    if (lastOtp) {
      const createdAtMs = this.getTimestampMs(lastOtp.createdAt);
      const diffMs = Date.now() - createdAtMs;
      const cooldownMs = 60 * 1000;

      if (diffMs < cooldownMs) {
        const waitSeconds = Math.ceil((cooldownMs - diffMs) / 1000);
        throw new BadRequestException(
          `Vui lòng chờ ${waitSeconds} giây nữa trước khi yêu cầu mã mới.`,
        );
      }

      await this.usersAuthService.deleteOtp(lastOtp.id);
    }

    const otpCode = this.generateOtpCode();
    const codeHash = this.hashSha256(otpCode);
    const expiresAt = Temporal.Instant.fromEpochMilliseconds(
      Date.now() + 5 * 60 * 1000,
    );

    const createdOtp = await this.usersAuthService.createOtp({
      email: user.email,
      codeHash,
      type: "FORGOT_PASSWORD",
      expiresAt,
      attempts: 0,
      userId: user.id,
    });

    const sent = await this.mailService.sendResetPasswordEmail(
      user.email,
      otpCode,
    );
    if (!sent) {
      await this.usersAuthService.deleteOtp(createdOtp.id);
    }

    return {
      message:
        "Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã OTP đặt lại mật khẩu.",
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<MessageResponseDto> {
    const email = dto.email;
    const otpRecord = await this.usersAuthService.findLatestOtp(
      email,
      "FORGOT_PASSWORD",
    );
    if (!otpRecord) {
      throw new NotFoundException(
        "Không tìm thấy yêu cầu đặt lại mật khẩu hoặc mã đã hết hạn.",
      );
    }

    if (otpRecord.attempts >= 5) {
      throw new ForbiddenException(
        "Bạn đã vượt quá số lần thử tối đa. Vui lòng yêu cầu mã OTP mới.",
      );
    }

    const expiresAtMs = this.getTimestampMs(otpRecord.expiresAt);
    if (Date.now() > expiresAtMs) {
      throw new BadRequestException(
        "Mã OTP đã hết hiệu lực. Vui lòng yêu cầu mã mới.",
      );
    }

    const inputHash = this.hashSha256(dto.code);
    if (inputHash !== otpRecord.codeHash) {
      await this.usersAuthService.incrementOtpAttempts(
        otpRecord.id,
        otpRecord.attempts + 1,
      );
      throw new BadRequestException("Mã OTP không chính xác.");
    }

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.usersAuthService.resetPasswordAndRevokeSessions(
      email,
      otpRecord.id,
      otpRecord.userId,
      passwordHash,
    );

    if (otpRecord.userId) {
      this.eventEmitter.emit(AUTH_EVENTS.USER_SESSIONS_REVOKED, {
        userId: otpRecord.userId,
      } satisfies UserSessionsRevokedEvent);
    }

    return {
      message:
        "Đặt lại mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.",
    };
  }

  private getTimestampMs(dateTime: any): number {
    if (!dateTime) return 0;
    if (typeof dateTime.epochMilliseconds === "number") {
      return dateTime.epochMilliseconds;
    }
    if (dateTime instanceof Date) {
      return dateTime.getTime();
    }
    return new Date(dateTime).getTime();
  }

  private hashSha256(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  private generateOtpCode(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    return this.jwtService.signAsync(
      {
        sub: userId,
        jti: crypto.randomUUID(),
      },
      {
        secret:
          this.configService?.get("JWT_REFRESH_SECRET", { infer: true }) ??
          process.env.JWT_REFRESH_SECRET,
        expiresIn: (this.configService?.get("JWT_REFRESH_EXPIRES_IN", {
          infer: true,
        }) ??
          process.env.JWT_REFRESH_EXPIRES_IN ??
          "7d") as any,
      },
    );
  }

  private async generateAccessToken(
    user: { id: string; email: string; username: string },
    sessionId: string,
  ): Promise<string> {
    const payload = {
      sub: user.id,
      email: user.email,
      username: user.username,
      sessionId, // Gắn ID của session vào đây
    };

    return this.jwtService.signAsync(payload, {
      secret:
        this.configService?.get("JWT_ACCESS_SECRET", { infer: true }) ??
        process.env.JWT_ACCESS_SECRET,
      expiresIn: (this.configService?.get("JWT_ACCESS_EXPIRES_IN", {
        infer: true,
      }) ??
        process.env.JWT_ACCESS_EXPIRES_IN ??
        "15m") as any,
    });
  }

  private async createSession(
    userId: string,
    refreshToken: string,
    meta: RequestMeta,
  ) {
    return this.usersAuthService.createSession(
      this.createSessionData(userId, refreshToken, meta),
    );
  }

  private createSessionData(
    userId: string,
    refreshToken: string,
    meta: RequestMeta,
  ) {
    return {
      userId,
      tokenHash: this.hashSha256(refreshToken),
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ipAddress ?? null,
      expiresAt: Temporal.Instant.fromEpochMilliseconds(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ),
      isRevoked: false,
    };
  }
}
