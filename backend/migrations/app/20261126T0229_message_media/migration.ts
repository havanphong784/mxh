#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/5e1d1f5b91cc0a9849531488859029e7179d93d1caa0c328de7704dc00a6c764/contract';
import endContract from '../../snapshots/5e1d1f5b91cc0a9849531488859029e7179d93d1caa0c328de7704dc00a6c764/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/a5cd9d506ba3af6ac41e72f943dbff0e43cee16b42478712ed25da289f0ee751/contract';
import startContract from '../../snapshots/a5cd9d506ba3af6ac41e72f943dbff0e43cee16b42478712ed25da289f0ee751/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropCheckConstraint({
        schema: 'public',
        table: 'message',
        constraint: 'message_type_check_c345b9c4',
      }),
      this.createTable({
        schema: 'public',
        table: 'messageMedia',
        columns: [
          col('bytes', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('format', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('height', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('messageId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('order', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('publicId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('url', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('width', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'messageMediaDeletion',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('publicId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('status', 'text', {
            notNull: true,
            default: lit('PENDING'),
            codecRef: { codecId: 'pg/text@1' },
          }),
        ],
        constraints: [primaryKey(['publicId'])],
      }),
      this.addCheckConstraint({
        schema: 'public',
        table: 'message',
        constraint: 'message_type_check_c9a41325',
        expression: "\"type\" IN ('TEXT', 'IMAGE')",
      }),
      this.addUnique({
        schema: 'public',
        table: 'messageMedia',
        constraint: 'messageMedia_publicId_key',
        columns: ['publicId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'messageMedia',
        constraint: 'messageMedia_messageId_order_key',
        columns: ['messageId', 'order'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'messageMedia',
        index: 'messageMedia_messageId_idx_3cdded8d',
        columns: ['messageId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'messageMedia',
        foreignKey: {
          name: 'messageMedia_messageId_fkey',
          columns: ['messageId'],
          references: { schema: 'public', table: 'message', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
