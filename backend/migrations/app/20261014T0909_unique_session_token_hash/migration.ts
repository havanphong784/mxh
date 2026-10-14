#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/aa9ce6715a4ffa80ebe35b1d1f30f163b27112dd1336741a6fe8040cf53af693/contract';
import startContract from '../../snapshots/aa9ce6715a4ffa80ebe35b1d1f30f163b27112dd1336741a6fe8040cf53af693/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b28f1a0b27873d1cffbbacf0a0c70333479aeb1086cbbd60571910cab9b48052/contract';
import endContract from '../../snapshots/b28f1a0b27873d1cffbbacf0a0c70333479aeb1086cbbd60571910cab9b48052/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      rawSql({
        id: 'data.session.deduplicate-token-hashes',
        label: 'Keep one session for each duplicated refresh-token hash',
        summary: 'Removes legacy duplicate sessions before enforcing tokenHash uniqueness',
        operationClass: 'data',
        target: {
          id: 'postgres',
          details: {
            schema: 'public',
            objectType: 'table',
            name: 'session',
          },
        },
        precheck: [
          {
            description: 'check for duplicated session token hashes',
            sql: `SELECT EXISTS (
              SELECT 1
              FROM "public"."session"
              GROUP BY "tokenHash"
              HAVING COUNT(*) > 1
            ) AS "result"`,
            params: [],
          },
        ],
        execute: [
          {
            description: 'remove duplicate sessions while keeping the newest active session',
            sql: `WITH ranked_sessions AS (
              SELECT
                "id",
                ROW_NUMBER() OVER (
                  PARTITION BY "tokenHash"
                  ORDER BY "isRevoked" ASC, "updatedAt" DESC, "createdAt" DESC, "id" DESC
                ) AS row_number
              FROM "public"."session"
            )
            DELETE FROM "public"."session" AS session_to_delete
            USING ranked_sessions
            WHERE session_to_delete."id" = ranked_sessions."id"
              AND ranked_sessions.row_number > 1`,
            params: [],
          },
        ],
        postcheck: [
          {
            description: 'verify session token hashes are unique',
            sql: `SELECT NOT EXISTS (
              SELECT 1
              FROM "public"."session"
              GROUP BY "tokenHash"
              HAVING COUNT(*) > 1
            ) AS "result"`,
            params: [],
          },
        ],
      }),
      this.dropIndex({
        schema: 'public',
        table: 'session',
        index: 'session_tokenHash_idx_79b60c2b',
      }),
      this.addUnique({
        schema: 'public',
        table: 'session',
        constraint: 'session_tokenHash_key',
        columns: ['tokenHash'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
