import { Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { UsersRepository } from './users.repository.js';
import type { Temporal } from '@js-temporal/polyfill';

/** Public UsersModule facade for authentication flows. */
@Injectable()
export class UsersAuthService {
  constructor(private readonly repo: UsersRepository) {}

  async findUserByEmail(email: string) {
    const user = await this.repo.findByEmail(email);
    if (!user) return null;
    return this.toAuthUser(user);
  }

  async findUserById(userId: string) {
    const user = await this.repo.findById(userId);
    return user ? this.toAuthUser(user) : null;
  }

  async verifyPassword(email: string, password: string): Promise<boolean> {
    const user = await this.repo.findByEmail(email);
    return user ? argon2.verify(user.passwordHash, password) : false;
  }

  async createSession(data: {
    userId: string; tokenHash: string; userAgent: string | null;
    ipAddress: string | null; expiresAt: Temporal.Instant; isRevoked: boolean;
  }) {
    const session = await this.repo.createSession(data);
    return { id: session.id };
  }

  async usernameExists(username: string): Promise<boolean> {
    return !!(await this.repo.findByUsername(username));
  }

  async createPendingUserWithOtp(data: {
    email: string; username: string; passwordHash: string; displayName: string;
    codeHash: string; expiresAt: Temporal.Instant;
  }) {
    return this.repo.createPendingUserWithOtp(data);
  }

  async deleteUserById(userId: string) {
    await this.repo.deleteUserById(userId);
  }

  async findLatestOtp(email: string, type: 'REGISTER_VERIFY' | 'FORGOT_PASSWORD') {
    const otp = await this.repo.findLatestOtp(email, type);
    if (!otp) return null;
    return {
      id: otp.id,
      codeHash: otp.codeHash,
      attempts: otp.attempts,
      expiresAt: otp.expiresAt,
      createdAt: otp.createdAt,
      userId: otp.userId,
    };
  }

  async incrementOtpAttempts(otpId: string, attempts: number) {
    await this.repo.incrementOtpAttempts(otpId, attempts);
  }

  async createOtp(data: {
    email: string; codeHash: string; type: 'REGISTER_VERIFY' | 'FORGOT_PASSWORD';
    expiresAt: Temporal.Instant; attempts: number; userId: string;
  }) {
    const otp = await this.repo.createOtp(data);
    return { id: otp.id };
  }

  async deleteOtp(otpId: string) {
    await this.repo.deleteOtp(otpId);
  }

  async activateAndCreateSession(
    email: string,
    otpId: string,
    sessionData: {
      userId: string; tokenHash: string; userAgent: string | null;
      ipAddress: string | null; expiresAt: Temporal.Instant; isRevoked: boolean;
    },
  ) {
    const session = await this.repo.activateAndCreateSession(email, otpId, sessionData);
    return { id: session.id };
  }

  async resetPasswordAndRevokeSessions(
    email: string, otpId: string, userId: string | null, passwordHash: string,
  ) {
    return this.repo.resetPasswordAndRevokeSessions(email, otpId, userId, passwordHash);
  }

  async findSessionByTokenHash(tokenHash: string) {
    const session = await this.repo.findSessionByTokenHash(tokenHash);
    if (!session) return null;
    return {
      id: session.id,
      userId: session.userId,
      isRevoked: session.isRevoked,
      expiresAt: session.expiresAt,
      updatedAt: session.updatedAt,
    };
  }

  async revokeSessionsForUser(userId: string) {
    await this.repo.revokeSessionsForUser(userId);
  }

  async rotateRefreshSession(
    sessionId: string,
    sessionData: {
      userId: string; tokenHash: string; userAgent: string | null;
      ipAddress: string | null; expiresAt: Temporal.Instant; isRevoked: boolean;
    },
  ) {
    const session = await this.repo.rotateRefreshSession(sessionId, sessionData);
    return session ? { id: session.id } : null;
  }

  async revokeSessionByTokenHash(tokenHash: string): Promise<string[]> {
    return this.repo.revokeSessionByTokenHash(tokenHash);
  }

  private toAuthUser(user: {
    id: string; email: string; username: string; displayName: string;
    avatarUrl: string | null; bannerUrl: string | null; bio: string | null;
    isActive: boolean; isEmailVerified: boolean; createdAt: unknown;
  }) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      bio: user.bio,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    };
  }
}
