import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service.js';

test('only one concurrent refresh request can rotate the same session', async () => {
    const oldSession = {
        id: 'old-session',
        userId: 'user-id',
        tokenHash: 'old-hash',
        isRevoked: false,
        expiresAt: new Date(Date.now() + 60_000),
        updatedAt: new Date(),
    };
    const user = {
        id: 'user-id',
        email: 'user@example.com',
        username: 'user',
        isActive: true,
        isEmailVerified: true,
    };
    const createdSessions: any[] = [];
    let sessionReads = 0;
    let releaseReads!: () => void;
    const bothRequestsRead = new Promise<void>((resolve) => { releaseReads = resolve; });
    let claimed = false;

    const sessionTable = {
        where() {
            const query: any = {
                async first() {
                    sessionReads += 1;
                    if (sessionReads === 2) releaseReads();
                    await bothRequestsRead;
                    return { ...oldSession, isRevoked: false };
                },
                async update(payload: Record<string, unknown>) {
                    Object.assign(oldSession, payload);
                },
                async delete() {},
            };
            return query;
        },
        async create(data: any) {
            const created = { id: `session-${createdSessions.length + 1}`, ...data };
            createdSessions.push(created);
            return created;
        },
    };
    const userTable = {
        where() {
            return { async first() { return user; } };
        },
    };
    const raw = {
        sql(strings: TemplateStringsArray, ...values: unknown[]) {
            return {
                affectedCount() {
                    return { build: () => ({ text: strings.join('?'), values }) };
                },
            };
        },
    };
    const client: any = {
        raw,
        orm: { public: { Session: sessionTable, User: userTable } },
        async transaction(callback: (tx: any) => Promise<unknown>) {
            return callback({
                orm: client.orm,
                async execute(plan: { text: string }) {
                    if (!plan.text.includes('isRevoked')) return { affectedRows: 0 };
                    if (claimed) return { affectedRows: 0 };
                    claimed = true;
                    oldSession.isRevoked = true;
                    return { affectedRows: 1 };
                },
            });
        },
    };
    const jwtService = {
        async verifyAsync() { return { sub: 'user-id' }; },
        async signAsync(payload: any, options: any) {
            return options.secret === process.env.JWT_REFRESH_SECRET
                ? `refresh-${payload.jti}`
                : `access-${payload.sessionId}`;
        },
    };
    const service = new AuthService(
        { client } as any,
        {} as any,
        jwtService as any,
        { emit() {} } as any,
    );

    const results = await Promise.allSettled([
        service.refreshTokens('same-refresh-token', {}),
        service.refreshTokens('same-refresh-token', {}),
    ]);

    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
    assert.equal(createdSessions.length, 1);
});

test('resend OTP removes the unusable code and reports a delivery failure', async () => {
    const user = {
        id: 'user-id',
        email: 'user@example.com',
        isEmailVerified: false,
    };
    let createdOtp: any = null;
    let deletedOtpId: string | null = null;
    const otpTable = {
        where(condition: any) {
            const query: any = {
                where() { return query; },
                orderBy() { return query; },
                async first() { return null; },
                async delete() { deletedOtpId = condition.id; },
            };
            return query;
        },
        async create(data: any) {
            createdOtp = { id: 'otp-id', ...data };
            return createdOtp;
        },
    };
    const prisma = {
        client: {
            orm: {
                public: {
                    User: {
                        where() {
                            return { async first() { return user; } };
                        },
                    },
                    OtpVerification: otpTable,
                },
            },
        },
    };
    const service = new AuthService(
        prisma as any,
        { async sendOtpEmail() { return false; } } as any,
        {} as any,
        {} as any,
    );

    await assert.rejects(
        service.resendOtp({ email: user.email }),
        BadRequestException,
    );
    assert.equal(deletedOtpId, createdOtp.id);
});
