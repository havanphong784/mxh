import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
    UnauthorizedException
} from '@nestjs/common';
import {PrismaService} from "../prisma/prisma.service.js";
import argon2 from 'argon2';
import * as crypto from "node:crypto";
import {MailService} from "../mail/mail.service.js";
import {RegisterDto} from "./dto/register.dto.js";
import {VerifyOtpDto} from "./dto/verify-otp.dto.js";
import {JwtService} from "@nestjs/jwt";
import {ResendOtpDto} from "./dto/resend-otp.dto.js";
import {LoginDto} from "./dto/login.dto.js";
import {ForgotPasswordDto} from "./dto/forgot-password.dto.js";
import {ResetPasswordDto} from "./dto/reset-password.dto.js";

declare const Temporal: any;

export interface RequestMeta {
    userAgent?: string;
    ipAddress?: string;
}

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
        private readonly jwtService: JwtService
    ) {}

    async getMe(userId: string) {
        const user = await this.prisma.client.orm.public.User
            .where((u) => u.id.eq(userId))
            .first();

        if (!user || !user.isActive) {
            throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa.');
        }

        return {
            id: user.id,
            email: user.email,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            bannerUrl: user.bannerUrl,
            bio: user.bio,
            isEmailVerified: user.isEmailVerified,
            createdAt: user.createdAt,
        };
    }

    async register(dto:RegisterDto) {
        const email = dto.email;
        const username = dto.username;

        const existingEmail = await this.prisma.client.orm.public.User
            .where((u) => u.email.eq(email)).first();
        if (existingEmail) {
            throw new ConflictException('Email đã tồn tại !');
        }

        const existingUsername = await this.prisma.client.orm.public.User
            .where((u) => u.username.eq(username)).first();
        if (existingUsername) {
            throw new ConflictException('Username đã tồn tại !');
        }

        const passwordHash = await argon2.hash(dto.password);
        const user = await this.prisma.client.orm.public.User
            .create({
                email,
                username,
                passwordHash,
                displayName: dto.displayName,
                isEmailVerified: false,
            })

        const otpCode = this.generateOtpCode();
        const codeHash = this.hashSha256(otpCode);
        const expiresAt = Temporal.Instant.fromEpochMilliseconds(
            Date.now() + 5 * 60 * 1000 // 5 phút
        );

        await this.prisma.client.orm.public.OtpVerification.create({
            email: user.email,
            codeHash,
            type: 'REGISTER_VERIFY',
            expiresAt,
            attempts: 0,
            userId: user.id,
        });

        await this.mailService.sendOtpEmail(user.email, otpCode);

        return {
            message: 'Đăng ký tài khoản thành công! Vui lòng kiểm tra email để nhận mã xác thực.',
            email: user.email,
        };
    }

    async verifyOtp(dto: VerifyOtpDto, meta: RequestMeta){
        const email = dto.email;
        const otpRecord = await this.prisma.client.orm.public.OtpVerification
            .where((o) => o.email.eq(email))
            .where((o) => o.type.eq('REGISTER_VERIFY'))
            .orderBy((o) => o.createdAt.desc())
            .first();
        if (!otpRecord) {
            throw new NotFoundException('Không tìm thấy yêu cầu xác thực hoặc mã đã hết hạn');
        }

        if (otpRecord.attempts >= 5) {
            throw new ForbiddenException('Bạn đã vượt quá số lần thử tối đa. Vui lòng yêu cầu mã OTP mới.');
        }

        if (Date.now() > (otpRecord.expiresAt as any).epochMilliseconds) {
            throw new BadRequestException('Mã OTP đã hết hiệu lực. Vui lòng lấy mã mới.');
        }

        const inputHash = this.hashSha256(dto.code);
        if (inputHash !== otpRecord.codeHash) {
            await this.prisma.client.orm.public.OtpVerification
                .where({ id: otpRecord.id })
                .update({ attempts: otpRecord.attempts + 1 });
            throw new BadRequestException('Mã OTP không chính xác');
        }

        await this.prisma.client.orm.public.User
            .where((u) => u.email.eq(email))
            .update({ isEmailVerified: true });

        const user = await this.prisma.client.orm.public.User
            .where((u) => u.email.eq(email))
            .first();

        await this.prisma.client.orm.public.OtpVerification
            .where({ id: otpRecord.id })
            .delete();

        if (!user) {
            throw new NotFoundException('Không tìm thấy thông tin người dùng');
        }

        const tokens = await this.generateTokens(user);
        await this.createSession(user.id, tokens.refreshToken, meta);

        return {
            message: 'Kích hoạt tài khoản thành công!',
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
            },
        };

    }

    async resendOtp(dto: ResendOtpDto) {
        const email = dto.email;
        const user = await this.prisma.client.orm.public.User
            .where((u) => u.email.eq(email))
            .first();
        if (!user) {
            throw new NotFoundException('Không tìm thấy tài khoản với email này.');
        }

        if (user.isEmailVerified) {
            throw new BadRequestException('Tài khoản này đã được kích hoạt trước đó. Vui lòng đăng nhập.');
        }

        const lastOtp = await this.prisma.client.orm.public.OtpVerification
            .where((o) => o.email.eq(email))
            .where((o) => o.type.eq('REGISTER_VERIFY'))
            .orderBy((o) => o.createdAt.desc())
            .first();

        if (lastOtp) {
            const createdAtMs = (lastOtp.createdAt as any).epochMilliseconds;
            const diffMs = Date.now() - createdAtMs;
            const cooldownMs = 60 * 1000;

            if (diffMs < cooldownMs) {
                const waitSeconds = Math.ceil((cooldownMs - diffMs) / 1000);
                throw new BadRequestException(`Vui lòng chờ ${waitSeconds} giây nữa trước khi yêu cầu mã mới.`);
            }

            await this.prisma.client.orm.public.OtpVerification
                .where({ id: lastOtp.id })
                .delete();
        }

        const otpCode = this.generateOtpCode();
        const codeHash = this.hashSha256(otpCode);
        const expiresAt = Temporal.Instant.fromEpochMilliseconds(
            Date.now() + 5 * 60 * 1000 // 5 phút
        );

        await this.prisma.client.orm.public.OtpVerification.create({
            email: user.email,
            codeHash,
            type: 'REGISTER_VERIFY',
            expiresAt,
            attempts: 0,
            userId: user.id,
        });

        await this.mailService.sendOtpEmail(user.email, otpCode);

        return {
            email: user.email,
            message: 'Mã xác thực mới đã được gửi vào email của bạn'
        };
    }

    async login(dto: LoginDto, meta: RequestMeta) {
        const email = dto.email;
        const user = await this.prisma.client.orm.public.User
            .where((u) => u.email.eq(email))
            .first();

        if (!user) {
            throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
        }

        if (!user.isActive) {
            throw new ForbiddenException('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
        }

        if (!user.isEmailVerified) {
            throw new ForbiddenException('Tài khoản chưa được kích hoạt. Vui lòng xác thực email trước khi đăng nhập.');
        }

        const isPasswordValid = await argon2.verify(user.passwordHash, dto.password);
        if (!isPasswordValid) {
            throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
        }

        const tokens = await this.generateTokens(user);
        await this.createSession(user.id, tokens.refreshToken, meta);

        return {
            message: 'Đăng nhập thành công!',
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
            },
        };
    }

    async refreshTokens(refreshToken: string, meta: RequestMeta) {
        let payload: any;
        try {
            payload = await this.jwtService.verifyAsync(refreshToken, {
                secret: process.env.JWT_REFRESH_SECRET,
            });
        } catch {
            throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn.');
        }

        const tokenHash = this.hashSha256(refreshToken);
        const session = await this.prisma.client.orm.public.Session
            .where((s) => s.tokenHash.eq(tokenHash))
            .first();

        if (!session) {
            throw new UnauthorizedException('Phiên đăng nhập không tồn tại hoặc đã bị đăng xuất.');
        }
        if (session.isRevoked) {
            await this.prisma.client.orm.public.Session
                .where((s) => s.userId.eq(session.userId))
                .update({ isRevoked: true });

            await this.prisma.client.orm.public.Session
                .where({ id: session.id })
                .delete();

            throw new ForbiddenException('Phát hiện dấu hiệu bất thường. Toàn bộ phiên đăng nhập đã bị hủy, vui lòng đăng nhập lại.');
        }

        if (Date.now() > (session.expiresAt as any).epochMilliseconds) {
            throw new UnauthorizedException('Phiên đăng nhập đã hết hạn.');
        }

        const user = await this.prisma.client.orm.public.User
            .where((u) => u.id.eq(session.userId))
            .first();

        if (!user || !user.isActive) {
            throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa.');
        }

        await this.prisma.client.orm.public.Session
            .where({ id: session.id })
            .update({ isRevoked: true });

        const tokens = await this.generateTokens(user);
        await this.createSession(user.id, tokens.refreshToken, meta);

        return {
            message: 'Làm mới phiên đăng nhập thành công!',
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        };
    }

    async logout(refreshToken?: string) {
        if (!refreshToken) {
            return { message: 'Đăng xuất thành công!' };
        }

        const tokenHash = this.hashSha256(refreshToken);

        const session = await this.prisma.client.orm.public.Session
            .where((s) => s.tokenHash.eq(tokenHash))
            .first();

        if (session) {
            await this.prisma.client.orm.public.Session
                .where({ id: session.id })
                .delete();
        }

        return {
            message: 'Đăng xuất thành công!',
        };
    }

    async forgotPassword(dto: ForgotPasswordDto) {
        const email = dto.email;
        const user = await this.prisma.client.orm.public.User
            .where((u) => u.email.eq(email))
            .first();

        if (!user || !user.isActive) {
            return {
                message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã OTP đặt lại mật khẩu.',
            };
        }

        const lastOtp = await this.prisma.client.orm.public.OtpVerification
            .where((o) => o.email.eq(email))
            .where((o) => o.type.eq('FORGOT_PASSWORD'))
            .orderBy((o) => o.createdAt.desc())
            .first();

        if (lastOtp) {
            const createdAtMs = (lastOtp.createdAt as any).epochMilliseconds;
            const diffMs = Date.now() - createdAtMs;
            const cooldownMs = 60 * 1000;

            if (diffMs < cooldownMs) {
                const waitSeconds = Math.ceil((cooldownMs - diffMs) / 1000);
                throw new BadRequestException(`Vui lòng chờ ${waitSeconds} giây nữa trước khi yêu cầu mã mới.`);
            }

            await this.prisma.client.orm.public.OtpVerification
                .where({ id: lastOtp.id })
                .delete();
        }

        const otpCode = this.generateOtpCode();
        const codeHash = this.hashSha256(otpCode);
        const expiresAt = Temporal.Instant.fromEpochMilliseconds(
            Date.now() + 5 * 60 * 1000
        );

        await this.prisma.client.orm.public.OtpVerification.create({
            email: user.email,
            codeHash,
            type: 'FORGOT_PASSWORD',
            expiresAt,
            attempts: 0,
            userId: user.id,
        });

        await this.mailService.sendResetPasswordEmail(user.email, otpCode);

        return {
            message: 'Nếu email tồn tại trong hệ thống, bạn sẽ nhận được mã OTP đặt lại mật khẩu.',
        };
    }

    async resetPassword(dto: ResetPasswordDto) {
        const email = dto.email;
        const otpRecord = await this.prisma.client.orm.public.OtpVerification
            .where((o) => o.email.eq(email))
            .where((o) => o.type.eq('FORGOT_PASSWORD'))
            .orderBy((o) => o.createdAt.desc())
            .first();
        if (!otpRecord) {
            throw new NotFoundException('Không tìm thấy yêu cầu đặt lại mật khẩu hoặc mã đã hết hạn.');
        }

        if (otpRecord.attempts >= 5) {
            throw new ForbiddenException('Bạn đã vượt quá số lần thử tối đa. Vui lòng yêu cầu mã OTP mới.');
        }

        if (Date.now() > (otpRecord.expiresAt as any).epochMilliseconds) {
            throw new BadRequestException('Mã OTP đã hết hiệu lực. Vui lòng yêu cầu mã mới.');
        }

        const inputHash = this.hashSha256(dto.code);
        if (inputHash !== otpRecord.codeHash) {
            await this.prisma.client.orm.public.OtpVerification
                .where({ id: otpRecord.id })
                .update({ attempts: otpRecord.attempts + 1 });
            throw new BadRequestException('Mã OTP không chính xác.');
        }

        const passwordHash = await argon2.hash(dto.newPassword);
        await this.prisma.client.orm.public.User
            .where((u) => u.email.eq(email))
            .update({ passwordHash });

        await this.prisma.client.orm.public.OtpVerification
            .where({ id: otpRecord.id })
            .delete();

        if (otpRecord.userId) {
            await this.prisma.client.orm.public.Session
                .where((s) => s.userId.eq(otpRecord.userId!))
                .delete();
        }

        return {
            message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.',
        };
    }

    private async createSession(userId: string, refreshToken: string, meta: RequestMeta) {
        const tokenHash = this.hashSha256(refreshToken);
        const expiresAt = Temporal.Instant.fromEpochMilliseconds(
            Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 ngày
        );

        await this.prisma.client.orm.public.Session.create({
            userId,
            tokenHash,
            userAgent: meta.userAgent ?? null,
            ipAddress: meta.ipAddress ?? null,
            expiresAt,
            isRevoked: false,
        });
    }

    private async generateTokens(user: { id: string; email: string; username: string }) {
        const payload = {
            sub: user.id,
            email: user.email,
            username: user.username,
        };

        const [accessToken, refreshToken] = await Promise.all([
            this.jwtService.signAsync(payload, {
                secret: process.env.JWT_ACCESS_SECRET,
                expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as any,
            }),
            this.jwtService.signAsync(payload, {
                secret: process.env.JWT_REFRESH_SECRET,
                expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as any,
            }),
        ]);

        return { accessToken, refreshToken };
    }

    private hashSha256(data: string): string {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    private generateOtpCode(): string {
        return crypto.randomInt(100000, 999999).toString();
    }
}
