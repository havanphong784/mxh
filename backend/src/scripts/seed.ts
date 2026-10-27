import 'dotenv/config';
import argon2 from 'argon2';
import { Temporal } from '@js-temporal/polyfill';
import { db } from '../prisma/db.js';
import { buildSeedData } from './seed-data.js';

const args = new Set(process.argv.slice(2));
const data = buildSeedData(new Date());
const summary = Object.fromEntries(Object.entries(data).map(([key, values]) => [key, values.length]));
const instant = (date: Date) => Temporal.Instant.fromEpochMilliseconds(date.getTime());

async function main() {
  if (args.has('--dry-run')) {
    console.table(summary);
    return;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Không chạy seed trên NODE_ENV=production.');
  }
  if (!process.env.DATABASE_URL) throw new Error('Thiếu DATABASE_URL.');
  const hostname = new URL(process.env.DATABASE_URL).hostname;
  if (!['localhost', '127.0.0.1', '::1'].includes(hostname) && !args.has('--allow-remote')) {
    throw new Error(`Database không nằm trên máy cục bộ (${hostname}). Chỉ dùng --allow-remote cho database thử nghiệm.`);
  }

  const password = process.env.SEED_PASSWORD || 'Demo1234!';
  const passwordHash = await argon2.hash(password);
  await db.connect();
  try {
    await db.transaction(async (tx) => {
      // IDs cố định và chỉ INSERT khi chưa có: chạy lại không nhân đôi và không ghi đè sửa đổi của người thử.
      const ensure = async (model: any, key: object, record: object) => {
        if (!(await model.where(key).first())) await model.create(record);
      };
      for (const user of data.users) {
        await ensure(tx.orm.public.User, { id: user.id }, {
          ...user, passwordHash, createdAt: instant(user.createdAt),
        });
      }
      for (const post of data.posts) {
        await ensure(tx.orm.public.Post, { id: post.id }, {
          ...post, createdAt: instant(post.createdAt),
          editedAt: post.editedAt ? instant(post.editedAt) : null,
        });
      }
      for (const item of data.media) {
        await ensure(tx.orm.public.PostMedia, { id: item.id }, {
          ...item, createdAt: instant(item.createdAt),
        });
      }
      for (const follow of data.follows) {
        await ensure(tx.orm.public.Follow,
          { followerId: follow.followerId, followingId: follow.followingId },
          { ...follow, createdAt: instant(follow.createdAt) });
      }
      for (const like of data.likes) {
        await ensure(tx.orm.public.PostLike, { userId: like.userId, postId: like.postId },
          { ...like, createdAt: instant(like.createdAt) });
      }
      for (const bookmark of data.bookmarks) {
        await ensure(tx.orm.public.PostBookmark,
          { userId: bookmark.userId, postId: bookmark.postId },
          { ...bookmark, createdAt: instant(bookmark.createdAt) });
      }
      for (const item of data.notifications) {
        await ensure(tx.orm.public.Notification, { id: item.id },
          { ...item, createdAt: instant(item.createdAt) });
      }
      for (const item of data.sessions) {
        await ensure(tx.orm.public.Session, { id: item.id }, {
          ...item, createdAt: instant(item.createdAt), expiresAt: instant(item.expiresAt),
        });
      }
      for (const item of data.otpCodes) {
        await ensure(tx.orm.public.OtpVerification, { id: item.id }, {
          ...item, createdAt: instant(item.createdAt), expiresAt: instant(item.expiresAt),
        });
      }
      // Khi seed được mở rộng ở phiên bản sau, bộ đếm của bài cũ vẫn khớp với quan hệ mới.
      const counters = db.raw.sql`
        UPDATE "post" AS p SET
          "likeCount" = (SELECT count(*)::int FROM "postLike" l WHERE l."postId" = p.id),
          "bookmarkCount" = (SELECT count(*)::int FROM "postBookmark" b WHERE b."postId" = p.id),
          "replyCount" = (SELECT count(*)::int FROM "post" r WHERE r."parentId" = p.id AND NOT r."isDeleted"),
          "repostCount" = (SELECT count(*)::int FROM "post" r WHERE r."repostOfId" = p.id AND NOT r."isDeleted"),
          "quoteCount" = (SELECT count(*)::int FROM "post" q WHERE q."quotedPostId" = p.id AND NOT q."isDeleted")
        WHERE p.id LIKE 'seed_v1_post_%'
      `.affectedCount().build();
      await tx.execute(counters);
    });
    console.table(summary);
    console.log('Seed hoàn tất. Email: <username>@example.test; mật khẩu: SEED_PASSWORD hoặc Demo1234!.');
  } finally {
    await db.close();
  }
}

main().catch((error) => {
  console.error('Seed thất bại:', error);
  process.exitCode = 1;
});
