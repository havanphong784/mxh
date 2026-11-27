import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { Temporal } from "@js-temporal/polyfill";
import { BadRequestException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import type { MailService } from "../mail/mail.service.js";
import type { UsersService } from "../users/users.service.js";

const databaseUrl = process.env.AUTH_TEST_DATABASE_URL;
if (!databaseUrl || process.env.NODE_ENV === "production")
  throw new Error("Set AUTH_TEST_DATABASE_URL to a migrated local test DB.");
if (!["localhost", "127.0.0.1", "[::1]"].includes(new URL(databaseUrl).hostname))
  throw new Error("Auth integration requires a loopback DB.");
process.env.DATABASE_URL = databaseUrl;
process.env.JWT_ACCESS_SECRET = randomUUID();
process.env.JWT_REFRESH_SECRET = randomUUID();
globalThis.Temporal = Temporal;
const { PrismaService } = await import("../prisma/prisma.service.js");
const { UsersRepository } = await import("../users/users.repository.js");
const { UsersAuthService } = await import("../users/users-auth.service.js");
const { AuthService } = await import("./auth.service.js");
const prisma = new PrismaService();
const repository = new UsersRepository(prisma);
const events = new EventEmitter2();
const service = new AuthService(
  {} as MailService,
  new JwtService(),
  events,
  {} as UsersService,
  new UsersAuthService(repository),
);
const users: string[] = [];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
let cases = 0;
await prisma.onModuleInit();
try {
  for (const type of ["REGISTER_VERIFY", "FORGOT_PASSWORD"] as const) {
    const run = randomUUID().replaceAll("-", "").slice(0, 12);
    const user = await prisma.client.orm.public.User.create({
      username: `otp_${run}`,
      email: `otp_${run}@example.test`,
      passwordHash: "old-hash",
      displayName: "OTP test",
    });
    users.push(user.id);
    const otp = () => repository.findLatestOtp(user.email, type);
    const createOtp = (attempts: number, expired = false) =>
      repository.createOtp({
        email: user.email,
        userId: user.id,
        type,
        codeHash: hash("123456"),
        attempts,
        expiresAt: Temporal.Instant.fromEpochMilliseconds(
          Date.now() + (expired ? -60_000 : 60_000),
        ),
      });
    const invoke = (code: string) =>
      type === "REGISTER_VERIFY"
        ? service.verifyOtp({ email: user.email, code }, {})
        : service.resetPassword({ email: user.email, code, newPassword: "ResetPassword123!" });
    const record = await createOtp(0);
    const failures = await Promise.allSettled(Array.from({ length: 5 }, () => invoke("000000")));
    for (const result of failures) {
      assert.equal(result.status, "rejected");
      if (result.status === "rejected")
        assert.ok(result.reason instanceof BadRequestException, String(result.reason));
    }
    assert.equal(
      (await otp())?.attempts,
      5,
      `${type}: parallel wrong attempts must all be counted`,
    );
    await assert.rejects(invoke("123456"));
    assert.equal((await otp())?.attempts, 5);
    await repository.deleteOtp(record.id);
    cases++;

    const last = await createOtp(4);
    const claims = await Promise.all(
      Array.from({ length: 8 }, () => repository.claimOtpAttempt(last.id)),
    );
    assert.equal(claims.filter(Boolean).length, 1, `${type}: only one claim at attempts=4`);
    assert.equal((await otp())?.attempts, 5);
    await repository.deleteOtp(last.id);
    cases++;

    const expired = await createOtp(0, true);
    assert.equal(await repository.claimOtpAttempt(expired.id), null);
    await assert.rejects(invoke("123456"));
    assert.equal((await otp())?.attempts, 0);
    await repository.deleteOtp(expired.id);
    cases++;

    const success = await createOtp(0);
    // Synchronize reads so both requests reach consumption with the same snapshot.
    const originalFind = repository.findLatestOtp.bind(repository);
    let reads = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    repository.findLatestOtp = async (...args) => {
      const snapshot = await originalFind(...args);
      if (++reads === 2) release();
      await gate;
      return snapshot;
    };
    const results = await Promise.allSettled([invoke("123456"), invoke("123456")]);
    repository.findLatestOtp = originalFind;
    assert.equal(
      results.filter((result) => result.status === "fulfilled").length,
      1,
      `${type}: OTP must be single-use`,
    );
    assert.equal(await repository.claimOtpAttempt(success.id), null);
    const sessions = await prisma.client.orm.public.Session.where({ userId: user.id }).all();
    assert.equal(sessions.length, type === "REGISTER_VERIFY" ? 1 : 0);
    cases++;
  }
  console.log(
    `Auth PostgreSQL integration: ${cases} cases passed (both flows, attempts, expiry, single-use)`,
  );
} finally {
  for (const id of users) await repository.deleteUserById(id);
  await prisma.onModuleDestroy();
}
