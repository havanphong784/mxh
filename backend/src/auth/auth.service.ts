import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException
} from '@nestjs/common';
import {PrismaService} from "../prisma/prisma.service.js";
import argon2 from 'argon2';
import * as crypto from "node:crypto";
import {MailService} from "../mail/mail.service.js";
import {RegisterDto} from "./dto/register.dto.js";
import {VerifyOtpDto} from "./dto/verify-otp.dto.js";
import {JwtService} from "@nestjs/jwt";

// Khai báo kiểu toàn cục cho Temporal API trong Node.js
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
