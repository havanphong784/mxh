import { Temporal } from "@js-temporal/polyfill";
import postgres from "@prisma/orm-postgres/runtime";
import { orm, type RuntimeQueryable } from "@prisma/orm-postgres/orm-client";
import { AsyncIterableResult } from "@prisma/orm-framework/components/runtime";
import contractJson from "../prisma/contract.json" with { type: "json" };
import type { Contract } from "../prisma/contract.js";
import type { PrismaService } from "../prisma/prisma.service.js";

export type TestPlan = Parameters<RuntimeQueryable["execute"]>[0];
type Row = Record<string, unknown>;

/** Compile through the installed ORM, replacing only database I/O. No connection is opened. */
export function createOrmTestClient(
  options: { query?: (plan: TestPlan) => Row[]; execute?: (plan: TestPlan) => number } = {},
) {
  globalThis.Temporal = Temporal;
  const db = postgres<Contract>({ contractJson });
  const plans: TestPlan[] = [];
  const runtime: RuntimeQueryable = {
    query<Row>(plan: TestPlan) {
      plans.push(plan);
      const rows = options.query?.(plan) ?? [];
      return new AsyncIterableResult<Row>(
        (async function* () {
          for (const row of rows) yield row as Row;
        })(),
      );
    },
    async execute(plan) {
      plans.push(plan);
      return { affectedRows: options.execute?.(plan) ?? 0 };
    },
  };
  const tables = orm({ context: db.context, runtime });
  const client = {
    ...db,
    orm: tables,
    transaction: async <T>(
      callback: (tx: { orm: typeof tables; execute: RuntimeQueryable["execute"] }) => Promise<T>,
    ) => callback({ orm: tables, execute: runtime.execute }),
  };
  return { prisma: { client } as unknown as PrismaService, plans };
}
