import {ConflictException, Injectable} from '@nestjs/common';
import {PrismaService} from "../prisma/prisma.service.js";
import argon2 from 'argon2';
import * as crypto from "node:crypto";
import {MailService} from "../mail/mail.service.js";
import {RegisterDto} from "./dto/register.dto.js";

@Injectable()
export class AuthService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
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
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // Có hạn 5 phút

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

    private hashSha256(data: string): string {
        return crypto.createHash('sha256').update(data).digest('hex');
    }

    private generateOtpCode(): string {
        return crypto.randomInt(100000, 999999).toString();
    }
}
