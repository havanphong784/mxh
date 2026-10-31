import 'reflect-metadata';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import * as crypto from 'node:crypto';
import { AuthService } from './auth.service.js';
import { UsersAuthService } from '../users/users-auth.service.js';
import { UsersRepository } from '../users/users.repository.js';

function createAuthService(prisma: any, mail: any, jwt: any, events: any, users?: any, usersAuth?: any) {
    return new AuthService(mail, jwt, events, users ?? ({} as any), usersAuth ?? new UsersAuthService(new UsersRepository(prisma)));
}

test('getMe reads the public Users facade without direct database access', async () => {
    const profile = {
        id: 'user-id', email: 'user@example.test', username: 'user', displayName: 'User',
        avatarUrl: null, bannerUrl: null, bio: null, isEmailVerified: true, createdAt: new Date(),
    };
    const users = { async getAuthProfile(id: string) { assert.equal(id, 'user-id'); return profile; } };
    const service = createAuthService({} as any, {} as any, {} as any, {} as any, users as any);

    assert.deepEqual(await service.getMe('user-id'), profile);
});

test('login reads credentials and creates its session through the Users auth facade', async () => {
    const user = {
        id: 'user-id', email: 'user@example.test', username: 'user', displayName: 'User',
        avatarUrl: null, bannerUrl: null, bio: null, isActive: true,
        isEmailVerified: true, createdAt: new Date(),
    };
    const usersAuth = {
        async findUserByEmail() { return user; },
        async verifyPassword() { return true; },
        async createSession() { return { id: 'session-id' }; },
    };
    const jwt = { async signAsync(payload: any) { return payload.sessionId ? 'access-token' : 'refresh-token'; } };
    const service = createAuthService({} as any, {} as any, jwt as any, {} as any, {} as any, usersAuth as any);

    const result = await service.login({ email: user.email, password: 'password' }, {});
    assert.equal(result.accessToken, 'access-token');
    assert.equal(result.user.id, 'user-id');
});

test('registration creates the pending user and OTP through the Users auth facade', async () => {
    const calls: string[] = [];
    const usersAuth = {
        async findUserByEmail() { return null; },
        async usernameExists() { return false; },
        async createPendingUserWithOtp() { calls.push('create'); return { id: 'user-id', email: 'new@example.test' }; },
    };
    const mail = { async sendOtpEmail() { calls.push('mail'); return true; } };
    const service = createAuthService({} as any, mail as any, {} as any, {} as any, {} as any, usersAuth as any);

    const result = await service.register({
        email: 'new@example.test', username: 'newuser', displayName: 'New User', password: 'Demo1234!',
    });
    assert.equal(result.email, 'new@example.test');
    assert.deepEqual(calls, ['create', 'mail']);
});

test('OTP verification activates the account through the Users auth facade', async () => {
    const account = {
        id: 'user-id', email: 'user@example.test', username: 'user', displayName: 'User',
        avatarUrl: null, bannerUrl: null, bio: null, isEmailVerified: false, createdAt: new Date(),
    };
    const usersAuth = {
        async findLatestOtp() { return { id: 'otp-id', codeHash: crypto.createHash('sha256').update('123456').digest('hex'), attempts: 0, expiresAt: new Date(Date.now() + 60_000) }; },
        async findUserByEmail() { return account; },
        async activateAndCreateSession() { return { id: 'session-id' }; },
    };
    const jwt = { async signAsync(payload: any) { return payload.sessionId ? 'access-token' : 'refresh-token'; } };
    const service = createAuthService({} as any, {} as any, jwt as any, {} as any, {} as any, usersAuth as any);

    const result = await service.verifyOtp({ email: account.email, code: '123456' }, {});
    assert.equal(result.user.isEmailVerified, true);
    assert.equal(result.accessToken, 'access-token');
});

test('resend OTP stores the new code through the Users auth facade', async () => {
    const usersAuth = {
        async findUserByEmail() { return { id: 'user-id', email: 'user@example.test', isEmailVerified: false }; },
        async findLatestOtp() { return null; },
        async createOtp() { return { id: 'otp-id' }; },
    };
    const mail = { async sendOtpEmail() { return true; } };
    const service = createAuthService({} as any, mail as any, {} as any, {} as any, {} as any, usersAuth as any);

    assert.equal((await service.resendOtp({ email: 'user@example.test' })).email, 'user@example.test');
});

test('forgot password stores the reset code through the Users auth facade', async () => {
    const usersAuth = {
        async findUserByEmail() { return { id: 'user-id', email: 'user@example.test', isActive: true }; },
        async findLatestOtp() { return null; },
        async createOtp() { return { id: 'otp-id' }; },
    };
    const mail = { async sendResetPasswordEmail() { return true; } };
    const service = createAuthService({} as any, mail as any, {} as any, {} as any, {} as any, usersAuth as any);

    assert.match((await service.forgotPassword({ email: 'user@example.test' })).message, /Nếu email tồn tại/);
});

test('password reset commits through the Users auth facade', async () => {
    const usersAuth = {
        async findLatestOtp() { return { id: 'otp-id', userId: 'user-id', codeHash: crypto.createHash('sha256').update('123456').digest('hex'), attempts: 0, expiresAt: new Date(Date.now() + 60_000) }; },
        async resetPasswordAndRevokeSessions() {},
    };
    const events: string[] = [];
    const service = createAuthService({} as any, {} as any, {} as any, { emit(name: string) { events.push(name); } } as any, {} as any, usersAuth as any);

    assert.match((await service.resetPassword({ email: 'user@example.test', code: '123456', newPassword: 'New1234!' })).message, /thành công/);
    assert.equal(events.length, 1);
});

test('refresh rotation reads and writes sessions through the Users auth facade', async () => {
    const session = {
        id: 'old-session', userId: 'user-id', isRevoked: false,
        expiresAt: new Date(Date.now() + 60_000), updatedAt: new Date(),
    };
    const user = {
        id: 'user-id', email: 'user@example.test', username: 'user',
        isActive: true, isEmailVerified: true,
    };
    const usersAuth = {
        async findSessionByTokenHash() { return session; },
        async findUserById() { return user; },
        async rotateRefreshSession() { return { id: 'new-session' }; },
    };
    const jwt = {
        async verifyAsync() { return { sub: 'user-id' }; },
        async signAsync(payload: any) { return payload.sessionId ? 'access-token' : 'refresh-token'; },
    };
    const service = createAuthService({} as any, {} as any, jwt as any, { emit() {} } as any, {} as any, usersAuth as any);

    assert.equal((await service.refreshTokens('old-refresh-token', {})).accessToken, 'access-token');
});

test('logout revokes sessions through the Users auth facade', async () => {
    const usersAuth = { async revokeSessionByTokenHash() { return ['session-id']; } };
    const events: string[] = [];
    const service = createAuthService({} as any, {} as any, {} as any, { emit(_name: string, payload: { sessionId: string }) { events.push(payload.sessionId); } } as any, {} as any, usersAuth as any);

    await service.logout('refresh-token');
    assert.deepEqual(events, ['session-id']);
});

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
    const service = createAuthService(
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
    const service = createAuthService(
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
    const service = createAuthService(
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
    const service = createAuthService(
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
    const service = createAuthService({ client } as any, {} as any, { async signAsync() { return 'signed-token'; } } as any, {} as any);

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
    const service = createAuthService({ client } as any, {} as any, {} as any, { emit() {} } as any);

    await assert.rejects(service.resetPassword({ email: 'user@example.test', code: '123456', newPassword: 'Demo5678!' }), /OTP delete failed/);
    assert.equal(passwordHash, 'old-hash');
});

test('logout revokes the session while retaining its audit record', async () => {
    let revoked = false;
    let deleted = false;
    const sessionTable = { where() { return { async all() { return [{ id: 'session-1' }]; }, async update(data: { isRevoked: boolean }) { revoked = data.isRevoked; }, async delete() { deleted = true; } }; } };
    const service = createAuthService(
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
    const service = createAuthService(
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
    const service = createAuthService(
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
    const service = createAuthService(
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
    const service = createAuthService({ client } as any, {} as any, jwtService as any, {} as any);

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
    const service = createAuthService({ client } as any, {} as any, { async signAsync() { return 'signed-token'; } } as any, {} as any);

    await assert.rejects(service.verifyOtp({ email: 'user@example.test', code: '123456' }, {}), /session insert failed/);
    assert.equal(verified, false);
});
