#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/aa9ce6715a4ffa80ebe35b1d1f30f163b27112dd1336741a6fe8040cf53af693/contract';
import endContract from '../../snapshots/aa9ce6715a4ffa80ebe35b1d1f30f163b27112dd1336741a6fe8040cf53af693/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'follow',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('followerId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('followingId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['followerId', 'followingId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'notification',
        columns: [
          col('actorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isRead', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('postId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('recipientId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'notification_type_check_a03de31c',
            "\"type\" IN ('LIKE', 'REPLY', 'REPOST', 'QUOTE', 'FOLLOW')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'otpVerification',
        columns: [
          col('attempts', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('codeHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'post',
        columns: [
          col('authorId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('bookmarkCount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('content', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('editedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-temporal@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isDeleted', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('likeCount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('parentId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('quoteCount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('quotedPostId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('replyCount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('repostCount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('repostOfId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('rootId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('visibility', 'text', {
            notNull: true,
            default: lit('PUBLIC'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'post_visibility_check_150b877b',
            "\"visibility\" IN ('PUBLIC', 'FOLLOWERS', 'PRIVATE')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'postBookmark',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('postId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['userId', 'postId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'postLike',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('postId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['userId', 'postId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'postMedia',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('duration', 'float8', { codecRef: { codecId: 'pg/float8@1' } }),
          col('height', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('order', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('postId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('publicId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('type', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('url', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('width', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'postMedia_type_check_840b43a3',
            "\"type\" IN ('IMAGE', 'VIDEO', 'AUDIO')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'session',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('expiresAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('ipAddress', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('isRevoked', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('userAgent', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'user',
        columns: [
          col('avatarPublicId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('avatarUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('bannerPublicId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('bannerUrl', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('bio', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('displayName', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('isActive', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('isEmailVerified', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('passwordHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('username', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'post',
        constraint: 'post_authorId_repostOfId_key',
        columns: ['authorId', 'repostOfId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_username_key',
        columns: ['username'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'follow',
        index: 'follow_followerId_idx_2aa6c62d',
        columns: ['followerId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'follow',
        index: 'follow_followingId_idx_1cf16645',
        columns: ['followingId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification',
        index: 'notification_actorId_idx_a58f6b4b',
        columns: ['actorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification',
        index: 'notification_postId_idx_a7a72715',
        columns: ['postId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification',
        index: 'notification_recipientId_createdAt_idx_4cb575bd',
        columns: ['recipientId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification',
        index: 'notification_recipientId_idx_c9527cf8',
        columns: ['recipientId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notification',
        index: 'notification_recipientId_isRead_createdAt_idx_f5035d6e',
        columns: ['recipientId', 'isRead', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'otpVerification',
        index: 'otpVerification_email_type_idx_c44cd4f9',
        columns: ['email', 'type'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'otpVerification',
        index: 'otpVerification_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'post',
        index: 'post_authorId_createdAt_idx_854b4c86',
        columns: ['authorId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'post',
        index: 'post_authorId_idx_e47547ed',
        columns: ['authorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'post',
        index: 'post_createdAt_idx_9575dbd7',
        columns: ['createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'post',
        index: 'post_parentId_createdAt_idx_d5e7872e',
        columns: ['parentId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'post',
        index: 'post_parentId_idx_6a68f597',
        columns: ['parentId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'post',
        index: 'post_quotedPostId_idx_0fd2e558',
        columns: ['quotedPostId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'post',
        index: 'post_repostOfId_idx_629bb631',
        columns: ['repostOfId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'post',
        index: 'post_rootId_createdAt_idx_1af84128',
        columns: ['rootId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'post',
        index: 'post_rootId_idx_d68d7552',
        columns: ['rootId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'postBookmark',
        index: 'postBookmark_postId_idx_a7a72715',
        columns: ['postId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'postBookmark',
        index: 'postBookmark_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'postBookmark',
        index: 'postBookmark_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'postLike',
        index: 'postLike_postId_createdAt_idx_b244c517',
        columns: ['postId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'postLike',
        index: 'postLike_postId_idx_a7a72715',
        columns: ['postId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'postLike',
        index: 'postLike_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'postLike',
        index: 'postLike_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'postMedia',
        index: 'postMedia_postId_idx_a7a72715',
        columns: ['postId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'postMedia',
        index: 'postMedia_postId_order_idx_8a2a2182',
        columns: ['postId', 'order'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'session',
        index: 'session_tokenHash_idx_79b60c2b',
        columns: ['tokenHash'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'session',
        index: 'session_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'follow',
        foreignKey: {
          name: 'follow_followerId_fkey',
          columns: ['followerId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'follow',
        foreignKey: {
          name: 'follow_followingId_fkey',
          columns: ['followingId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'notification',
        foreignKey: {
          name: 'notification_recipientId_fkey',
          columns: ['recipientId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'notification',
        foreignKey: {
          name: 'notification_actorId_fkey',
          columns: ['actorId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'notification',
        foreignKey: {
          name: 'notification_postId_fkey',
          columns: ['postId'],
          references: { schema: 'public', table: 'post', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'otpVerification',
        foreignKey: {
          name: 'otpVerification_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'post',
        foreignKey: {
          name: 'post_authorId_fkey',
          columns: ['authorId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'post',
        foreignKey: {
          name: 'post_parentId_fkey',
          columns: ['parentId'],
          references: { schema: 'public', table: 'post', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'post',
        foreignKey: {
          name: 'post_rootId_fkey',
          columns: ['rootId'],
          references: { schema: 'public', table: 'post', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'post',
        foreignKey: {
          name: 'post_repostOfId_fkey',
          columns: ['repostOfId'],
          references: { schema: 'public', table: 'post', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'post',
        foreignKey: {
          name: 'post_quotedPostId_fkey',
          columns: ['quotedPostId'],
          references: { schema: 'public', table: 'post', columns: ['id'] },
          onDelete: 'setNull',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'postBookmark',
        foreignKey: {
          name: 'postBookmark_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'postBookmark',
        foreignKey: {
          name: 'postBookmark_postId_fkey',
          columns: ['postId'],
          references: { schema: 'public', table: 'post', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'postLike',
        foreignKey: {
          name: 'postLike_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'postLike',
        foreignKey: {
          name: 'postLike_postId_fkey',
          columns: ['postId'],
          references: { schema: 'public', table: 'post', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'postMedia',
        foreignKey: {
          name: 'postMedia_postId_fkey',
          columns: ['postId'],
          references: { schema: 'public', table: 'post', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'session',
        foreignKey: {
          name: 'session_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
