import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service.js";
import { toContainsPattern } from "../common/search.js";
import type { Temporal } from "@js-temporal/polyfill";

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  get user() {
    return this.prisma.client.orm.public.User;
  }

  get follow() {
    return this.prisma.client.orm.public.Follow;
  }

  get session() {
    return this.prisma.client.orm.public.Session;
  }

  async findById(userId: string) {
    return this.user.where((u) => u.id.eq(userId)).first();
  }

  async findByEmail(email: string) {
    return this.user.where((u) => u.email.eq(email)).first();
  }

  async createSession(data: {
    userId: string; tokenHash: string; userAgent: string | null;
    ipAddress: string | null; expiresAt: Temporal.Instant; isRevoked: boolean;
  }) {
    return this.session.create(data);
  }

  async createPendingUserWithOtp(data: {
    email: string; username: string; passwordHash: string; displayName: string;
    codeHash: string; expiresAt: Temporal.Instant;
  }) {
    return this.prisma.client.transaction(async (tx) => {
      const user = await tx.orm.public.User.create({
        email: data.email, username: data.username,
        passwordHash: data.passwordHash, displayName: data.displayName,
        isEmailVerified: false,
      });
      await tx.orm.public.OtpVerification.create({
        email: user.email, codeHash: data.codeHash, type: 'REGISTER_VERIFY',
        expiresAt: data.expiresAt, attempts: 0, userId: user.id,
      });
      return { id: user.id, email: user.email };
    });
  }

  async deleteUserById(userId: string) {
    return this.user.where({ id: userId }).delete();
  }

  async findLatestOtp(email: string, type: 'REGISTER_VERIFY' | 'FORGOT_PASSWORD') {
    return this.prisma.client.orm.public.OtpVerification
      .where((otp) => otp.email.eq(email))
      .where((otp) => otp.type.eq(type))
      .orderBy((otp) => otp.createdAt.desc()).first();
  }

  async incrementOtpAttempts(otpId: string, attempts: number) {
    return this.prisma.client.orm.public.OtpVerification
      .where({ id: otpId }).update({ attempts });
  }

  async createOtp(data: {
    email: string; codeHash: string; type: 'REGISTER_VERIFY' | 'FORGOT_PASSWORD';
    expiresAt: Temporal.Instant; attempts: number; userId: string;
  }) {
    return this.prisma.client.orm.public.OtpVerification.create(data);
  }

  async deleteOtp(otpId: string) {
    return this.prisma.client.orm.public.OtpVerification.where({ id: otpId }).delete();
  }

  async activateAndCreateSession(
    email: string,
    otpId: string,
    sessionData: {
      userId: string; tokenHash: string; userAgent: string | null;
      ipAddress: string | null; expiresAt: Temporal.Instant; isRevoked: boolean;
    },
  ) {
    return this.prisma.client.transaction(async (tx) => {
      await tx.orm.public.User.where((user) => user.email.eq(email))
        .update({ isEmailVerified: true });
      await tx.orm.public.OtpVerification.where({ id: otpId }).delete();
      return tx.orm.public.Session.create(sessionData);
    });
  }

  async resetPasswordAndRevokeSessions(
    email: string, otpId: string, userId: string | null, passwordHash: string,
  ) {
    await this.prisma.client.transaction(async (tx) => {
      await tx.orm.public.User.where((user) => user.email.eq(email)).update({ passwordHash });
      await tx.orm.public.OtpVerification.where({ id: otpId }).delete();
      if (userId) {
        await tx.orm.public.Session.where((session) => session.userId.eq(userId))
          .update({ isRevoked: true });
      }
    });
  }

  async findSessionByTokenHash(tokenHash: string) {
    return this.session.where((session) => session.tokenHash.eq(tokenHash)).first();
  }

  async revokeSessionsForUser(userId: string) {
    return this.session.where((session) => session.userId.eq(userId))
      .update({ isRevoked: true });
  }

  async rotateRefreshSession(
    sessionId: string,
    sessionData: {
      userId: string; tokenHash: string; userAgent: string | null;
      ipAddress: string | null; expiresAt: Temporal.Instant; isRevoked: boolean;
    },
  ) {
    return this.prisma.client.transaction(async (tx) => {
      const claimPlan = this.prisma.client.raw.sql`
        UPDATE "session"
        SET "isRevoked" = true, "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = ${sessionId} AND "isRevoked" = false
      `.affectedCount().build();
      const { affectedRows } = await tx.execute(claimPlan);
      if (affectedRows !== 1) return null;
      return tx.orm.public.Session.create(sessionData);
    });
  }

  async revokeSessionByTokenHash(tokenHash: string): Promise<string[]> {
    const sessions = await this.session.where((session) => session.tokenHash.eq(tokenHash)).all();
    await this.session.where((session) => session.tokenHash.eq(tokenHash))
      .update({ isRevoked: true });
    return sessions.map((session) => session.id);
  }

  async findAccessSession(sessionId: string) {
    return this.session.where((s) => s.id.eq(sessionId)).include('user').first();
  }

  async searchActiveUsers(term: string, cursor: string | undefined, limit: number) {
    const pattern = toContainsPattern(term);
    const matchingUsers = (field: 'username' | 'displayName') => {
      let query = this.user.where((u) => u.isActive.eq(true))
        .where((u) => u.isEmailVerified.eq(true))
        .where((u) => u[field].ilike(pattern));
      if (cursor) query = query.where((u) => u.username.gt(cursor));
      return query.orderBy((u) => u.username.asc()).limit(limit + 1).all();
    };
    const [byUsername, byDisplayName] = await Promise.all([
      matchingUsers('username'), matchingUsers('displayName'),
    ]);
    return { byUsername, byDisplayName };
  }

  async findSuggestionCandidates() {
    return this.user.where((u) => u.isActive.eq(true))
      .where((u) => u.isEmailVerified.eq(true))
      .orderBy((u) => u.createdAt.desc()).limit(24).all();
  }

  async findFollowsToCandidates(viewerId: string, candidateIds: string[]) {
    return this.follow.where((f) => f.followerId.eq(viewerId))
      .where((f) => f.followingId.in(candidateIds)).all();
  }

  async createFollow(followerId: string, followingId: string) {
    return this.follow.create({ followerId, followingId });
  }

  async updateUser(userId: string, payload: Record<string, any>) {
    return this.user.where((u) => u.id.eq(userId)).update(payload);
  }

  async changePasswordAndRevokeSessions(
    userId: string,
    passwordHash: string,
    logoutOtherDevices: boolean,
    currentSessionId?: string,
  ) {
    await this.prisma.client.transaction(async (tx) => {
      await tx.orm.public.User.where((u) => u.id.eq(userId)).update({ passwordHash });
      if (!logoutOtherDevices) return;

      const sessions = await tx.orm.public.Session.where((s) => s.userId.eq(userId)).all();
      for (const session of sessions) {
        if (session.id !== currentSessionId) {
          await tx.orm.public.Session.where({ id: session.id }).update({ isRevoked: true });
        }
      }
    });
  }

  async deleteFollow(followerId: string, followingId: string) {
    return this.follow.where((f) => f.followerId.eq(followerId))
      .where((f) => f.followingId.eq(followingId)).delete();
  }

  async findByUsername(username: string) {
    return this.user
      .where((u) => u.username.eq(username.toLowerCase()))
      .first();
  }

  async findFollow(followerId: string, followingId: string) {
    return this.follow
      .where((f) => f.followerId.eq(followerId))
      .where((f) => f.followingId.eq(followingId))
      .first();
  }

  async findActiveFollowingIds(followerId: string): Promise<string[]> {
    const follows = await this.follow.where((f) => f.followerId.eq(followerId))
      .where((f) => f.following.some((u) => u.isActive.eq(true)))
      .where((f) => f.following.some((u) => u.isEmailVerified.eq(true)))
      .all();
    return follows.map((follow) => follow.followingId);
  }

  async findFollowerIds(followingId: string): Promise<string[]> {
    const follows = await this.follow.where((f) => f.followingId.eq(followingId)).all();
    return follows.map((follow) => follow.followerId);
  }

  async listFollowers(
    userId: string,
    options: { limit: number; offset?: number; cursor?: { createdAt: Temporal.Instant; id: string } },
  ) {
    let query = this.follow.where((f) => f.followingId.eq(userId))
      .where((f) => f.follower.some((u) => u.isActive.eq(true)))
      .where((f) => f.follower.some((u) => u.isEmailVerified.eq(true)))
      .orderBy([(f) => f.createdAt.desc(), (f) => f.followerId.desc()])
      .limit(options.limit).include('follower');
    if (options.offset !== undefined) query = query.offset(options.offset);
    if (options.cursor) query = query.cursor(options.cursor);
    return query.all();
  }

  async listFollowing(
    userId: string,
    options: { limit: number; offset?: number; cursor?: { createdAt: Temporal.Instant; id: string } },
  ) {
    let query = this.follow.where((f) => f.followerId.eq(userId))
      .where((f) => f.following.some((u) => u.isActive.eq(true)))
      .where((f) => f.following.some((u) => u.isEmailVerified.eq(true)))
      .orderBy([(f) => f.createdAt.desc(), (f) => f.followingId.desc()])
      .limit(options.limit).include('following');
    if (options.offset !== undefined) query = query.offset(options.offset);
    if (options.cursor) query = query.cursor(options.cursor);
    return query.all();
  }

  async countFollowers(userId: string): Promise<number> {
    const agg = await this.follow
      .where((f) => f.followingId.eq(userId))
      .where((f) => f.follower.some((u) => u.isActive.eq(true)))
      .where((f) => f.follower.some((u) => u.isEmailVerified.eq(true)))
      .aggregate((a) => ({ total: a.count() }));
    return Number(agg.total) || 0;
  }

  async countFollowing(userId: string): Promise<number> {
    const agg = await this.follow
      .where((f) => f.followerId.eq(userId))
      .where((f) => f.following.some((u) => u.isActive.eq(true)))
      .where((f) => f.following.some((u) => u.isEmailVerified.eq(true)))
      .aggregate((a) => ({ total: a.count() }));
    return Number(agg.total) || 0;
  }
}
