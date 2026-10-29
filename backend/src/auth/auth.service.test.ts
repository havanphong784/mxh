import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'node:crypto';
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

test('forgot password removes an OTP that could not be delivered', async () => {
    const user = { id: 'user-id', email: 'user@example.com', isActive: true };
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
        async create(data: any) { return { id: 'reset-otp', ...data }; },
    };
    const service = new AuthService(
        { client: { orm: { public: {
            User: { where() { return { async first() { return user; } }; } },
            OtpVerification: otpTable,
        } } } } as any,
        { async sendResetPasswordEmail() { return false; } } as any,
        {} as any,
        {} as any,
    );

    const response = await service.forgotPassword({ email: user.email });

    assert.equal(deletedOtpId, 'reset-otp');
    assert.match(response.message, /Nếu email tồn tại/);
});

test('registration rolls back the user when OTP persistence fails', async () => {
    let persistedUser: { id: string; email: string } | null = null;
    const userTable = {
        where() { return { async first() { return null; } }; },
        async create(data: { email: string }) {
            persistedUser = { id: 'new-user', email: data.email };
            return persistedUser;
        },
    };
    const otpTable = {
        async create() { throw new Error('OTP write failed'); },
    };
    const orm = { public: { User: userTable, OtpVerification: otpTable } };
    const client = {
        orm,
        async transaction<T>(callback: (tx: { orm: typeof orm }) => Promise<T>): Promise<T> {
            const previousUser = persistedUser;
            try { return await callback({ orm }); }
            catch (error) { persistedUser = previousUser; throw error; }
        },
    };
    const service = new AuthService(
        { client } as any, {} as any, {} as any, {} as any,
    );

    await assert.rejects(
        service.register({ email: 'new@example.test', username: 'newuser', displayName: 'New User', password: 'Demo1234!' }),
        /OTP write failed/,
    );
    assert.equal(persistedUser, null);
});

test('OTP verification rolls back account activation when OTP deletion fails', async () => {
    let verified = false;
    const user = { id: 'user-id', email: 'user@example.test', username: 'user', isEmailVerified: false };
    const otp = { id: 'otp-id', codeHash: crypto.createHash('sha256').update('123456').digest('hex'), attempts: 0, expiresAt: new Date(Date.now() + 60_000) };
    const userTable = { where() { return { async update(data: { isEmailVerified: boolean }) { verified = data.isEmailVerified; }, async first() { return user; } }; } };
    const otpTable = { where() { const query = { where() { return query; }, orderBy() { return query; }, async first() { return otp; }, async delete() { throw new Error('OTP delete failed'); } }; return query; } };
    const orm = { public: { User: userTable, OtpVerification: otpTable } };
    const client = { orm, async transaction<T>(callback: (tx: { orm: typeof orm }) => Promise<T>): Promise<T> { const previous = verified; try { return await callback({ orm }); } catch (error) { verified = previous; throw error; } } };
    const service = new AuthService({ client } as any, {} as any, { async signAsync() { return 'signed-token'; } } as any, {} as any);

    await assert.rejects(service.verifyOtp({ email: user.email, code: '123456' }, {}), /OTP delete failed/);
    assert.equal(verified, false);
});

test('password reset rolls back password change when OTP deletion fails', async () => {
    let passwordHash = 'old-hash';
    const otp = { id: 'otp-id', userId: 'user-id', codeHash: crypto.createHash('sha256').update('123456').digest('hex'), attempts: 0, expiresAt: new Date(Date.now() + 60_000) };
    const userTable = { where() { return { async update(data: { passwordHash: string }) { passwordHash = data.passwordHash; } }; } };
    const otpTable = { where() { const query = { where() { return query; }, orderBy() { return query; }, async first() { return otp; }, async delete() { throw new Error('OTP delete failed'); } }; return query; } };
    const sessionTable = { where() { return { async update() {} }; } };
    const orm = { public: { User: userTable, OtpVerification: otpTable, Session: sessionTable } };
    const client = { orm, async transaction<T>(callback: (tx: { orm: typeof orm }) => Promise<T>): Promise<T> { const previous = passwordHash; try { return await callback({ orm }); } catch (error) { passwordHash = previous; throw error; } } };
    const service = new AuthService({ client } as any, {} as any, {} as any, { emit() {} } as any);

    await assert.rejects(service.resetPassword({ email: 'user@example.test', code: '123456', newPassword: 'Demo5678!' }), /OTP delete failed/);
    assert.equal(passwordHash, 'old-hash');
});

test('logout revokes the session while retaining its audit record', async () => {
    let revoked = false;
    let deleted = false;
    const sessionTable = { where() { return { async all() { return [{ id: 'session-1' }]; }, async update(data: { isRevoked: boolean }) { revoked = data.isRevoked; }, async delete() { deleted = true; } }; } };
    const service = new AuthService(
        { client: { orm: { public: { Session: sessionTable } } } } as any,
        {} as any,
        {} as any,
        { emit() {} } as any,
    );

    await service.logout('refresh-token');

    assert.equal(revoked, true);
    assert.equal(deleted, false);
});

test('invalid login credentials carry the documented error code', async () => {
    const userTable = { where() { return { async first() { return null; } }; } };
    const service = new AuthService(
        { client: { orm: { public: { User: userTable } } } } as any,
        {} as any, {} as any, {} as any,
    );

    await assert.rejects(service.login({ email: 'missing@example.test', password: 'wrong' }, {}), (error: any) => {
        assert.equal(error.getResponse().code, 'AUTH_INVALID_CREDENTIALS');
        return true;
    });
});

test('duplicate registration email carries AUTH_EMAIL_CONFLICT', async () => {
    const userTable = { where() { return { async first() { return { isEmailVerified: true }; } }; } };
    const service = new AuthService(
        { client: { orm: { public: { User: userTable } } } } as any,
        {} as any, {} as any, {} as any,
    );

    await assert.rejects(service.register({ email: 'taken@example.test', username: 'newuser', displayName: 'New User', password: 'Demo1234!' }), (error: any) => {
        assert.equal(error.getResponse().code, 'AUTH_EMAIL_CONFLICT');
        return true;
    });
});

test('unverified duplicate registration email uses the same conflict code', async () => {
    const userTable = { where() { return { async first() { return { isEmailVerified: false }; } }; } };
    const service = new AuthService(
        { client: { orm: { public: { User: userTable } } } } as any,
        {} as any, {} as any, {} as any,
    );

    await assert.rejects(service.register({ email: 'taken@example.test', username: 'newuser', displayName: 'New User', password: 'Demo1234!' }), (error: any) => {
        assert.equal(error.getResponse().code, 'AUTH_EMAIL_CONFLICT');
        return true;
    });
});

test('OTP verification returns the newly verified account state', async () => {
    let verified = false;
    const otp = { id: 'otp-id', codeHash: crypto.createHash('sha256').update('123456').digest('hex'), attempts: 0, expiresAt: new Date(Date.now() + 60_000) };
    const userTable = { where() { return { async first() { return { id: 'user-id', email: 'user@example.test', username: 'user', displayName: 'User', avatarUrl: null, bannerUrl: null, bio: null, createdAt: new Date(), isEmailVerified: verified }; }, async update() { verified = true; } }; } };
    const otpTable = { where() { const query = { where() { return query; }, orderBy() { return query; }, async first() { return otp; }, async delete() {} }; return query; } };
    const sessionTable = { async create() { return { id: 'session-id' }; } };
    const orm = { public: { User: userTable, OtpVerification: otpTable, Session: sessionTable } };
    const client = { orm, async transaction<T>(callback: (tx: { orm: typeof orm }) => Promise<T>) { return callback({ orm }); } };
    const jwtService = { async signAsync() { return 'signed-token'; } };
    const service = new AuthService({ client } as any, {} as any, jwtService as any, {} as any);

    const result = await service.verifyOtp({ email: 'user@example.test', code: '123456' }, {});

    assert.equal(result.user.isEmailVerified, true);
});

test('OTP verification rolls back activation if session creation fails', async () => {
    let verified = false;
    const otp = { id: 'otp-id', codeHash: crypto.createHash('sha256').update('123456').digest('hex'), attempts: 0, expiresAt: new Date(Date.now() + 60_000) };
    const userTable = { where() { return { async first() { return { id: 'user-id', email: 'user@example.test', username: 'user', isEmailVerified: verified }; }, async update() { verified = true; } }; } };
    const otpTable = { where() { const query = { where() { return query; }, orderBy() { return query; }, async first() { return otp; }, async delete() {} }; return query; } };
    const sessionTable = { async create() { throw new Error('session insert failed'); } };
    const orm = { public: { User: userTable, OtpVerification: otpTable, Session: sessionTable } };
    const client = { orm, async transaction<T>(callback: (tx: { orm: typeof orm }) => Promise<T>) { const previous = verified; try { return await callback({ orm }); } catch (error) { verified = previous; throw error; } } };
    const service = new AuthService({ client } as any, {} as any, { async signAsync() { return 'signed-token'; } } as any, {} as any);

    await assert.rejects(service.verifyOtp({ email: 'user@example.test', code: '123456' }, {}), /session insert failed/);
    assert.equal(verified, false);
});
