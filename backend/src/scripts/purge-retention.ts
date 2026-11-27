import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../app.module.js";
import { PrismaService } from "../prisma/prisma.service.js";

const TOMBSTONE_PURGE_BATCH_SIZE = 200;

export interface PurgeRetentionResult {
  deletedOtps: number;
  deletedSessions: number;
  deletedNotifications: number;
  deletedTombstonePosts: number;
}

export async function executePurgeRetention(prisma: PrismaService): Promise<PurgeRetentionResult> {
  // 1. Purge expired OTPs older than 1 day
  const otpPlan = prisma.client.raw.sql`
    DELETE FROM "otpVerification"
    WHERE "expiresAt" < (NOW() - INTERVAL '1 day')
  `
    .affectedCount()
    .build();

  // 2. Purge revoked sessions or expired sessions older than 30 days
  const sessionPlan = prisma.client.raw.sql`
    DELETE FROM "session"
    WHERE "isRevoked" = true
       OR "expiresAt" < (NOW() - INTERVAL '30 days')
  `
    .affectedCount()
    .build();

  // 3. Purge read notifications older than 90 days
  const notifPlan = prisma.client.raw.sql`
    DELETE FROM "notification"
    WHERE "isRead" = true
      AND "createdAt" < (NOW() - INTERVAL '90 days')
  `
    .affectedCount()
    .build();

  const [otpRes, sessionRes, notifRes] = await prisma.client.transaction(async (tx) => {
    const o = await tx.execute(otpPlan);
    const s = await tx.execute(sessionPlan);
    const n = await tx.execute(notifPlan);
    return [o, s, n];
  });

  // Filter before limiting so retained ancestors cannot starve eligible rows.
  const postLocks = prisma.client.raw.sql`
    SELECT candidate.id FROM "post" AS candidate
    WHERE candidate."isDeleted" = true
      AND NOT EXISTS (
        SELECT 1 FROM "post" AS child
        WHERE child."parentId" = candidate.id OR child."rootId" = candidate.id
      )
    ORDER BY candidate.id
    LIMIT ${TOMBSTONE_PURGE_BATCH_SIZE}
    FOR UPDATE SKIP LOCKED
  `
    .returnsRow({ id: "pg/text@1" })
    .build();
  let deletedTombstonePosts = 0;
  while (true) {
    // Release this batch's locks before opening the next transaction. Recheck
    // relationships in a fresh statement after locking to serialize FK inserts.
    const batch = await prisma.client.transaction(async (tx) => {
      const locked = await tx.query(postLocks);
      if (locked.length === 0) return { candidates: 0, deleted: 0 };
      const postPlan = prisma.client.raw.sql`
        DELETE FROM "post" AS candidate
        WHERE candidate.id IN (
          SELECT jsonb_array_elements_text(${JSON.stringify(locked.map((row) => row.id))}::jsonb)
        )
          AND candidate."isDeleted" = true
          AND NOT EXISTS (
            SELECT 1 FROM "post" AS child
            WHERE child."parentId" = candidate.id OR child."rootId" = candidate.id
          )
      `
        .affectedCount()
        .build();
      const result = await tx.execute(postPlan);
      return { candidates: locked.length, deleted: result?.affectedRows ?? 0 };
    });
    deletedTombstonePosts += batch.deleted;
    if (batch.candidates === 0) break;
  }

  return {
    deletedOtps: otpRes?.affectedRows ?? 0,
    deletedSessions: sessionRes?.affectedRows ?? 0,
    deletedNotifications: notifRes?.affectedRows ?? 0,
    deletedTombstonePosts,
  };
}

async function run() {
  console.log("--- BẮT ĐẦU DỌN DẸP DỮ LIỆU ĐỊNH KỲ (DATA RETENTION & PURGE WORKER) ---");
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error", "warn"],
  });

  try {
    const prisma = app.get(PrismaService);
    const result = await executePurgeRetention(prisma);

    console.log(`\n Kết quả dọn dẹp:`);
    console.log(`- OTP hết hạn đã xóa: ${result.deletedOtps}`);
    console.log(`- Phiên (Session) cũ/revoked đã xóa: ${result.deletedSessions}`);
    console.log(`- Thông báo (Notification) đã đọc >90 ngày: ${result.deletedNotifications}`);
    console.log(`- Tombstone Post không còn tham chiếu con/root: ${result.deletedTombstonePosts}`);
    console.log("\n Dọn dẹp hoàn tất thành công!");
  } catch (error) {
    console.error(" Lỗi trong quá trình dọn dẹp:", error);
  } finally {
    await app.close();
  }
}

if (process.argv[1] && process.argv[1].endsWith("purge-retention.ts")) {
  run();
}
