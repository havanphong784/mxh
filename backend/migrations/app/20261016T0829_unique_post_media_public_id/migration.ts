#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/5e5f298be81ef8cc6954b6f25b4c57b300094ad618a04d87561583e1a0942c64/contract';
import endContract from '../../snapshots/5e5f298be81ef8cc6954b6f25b4c57b300094ad618a04d87561583e1a0942c64/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/b28f1a0b27873d1cffbbacf0a0c70333479aeb1086cbbd60571910cab9b48052/contract';
import startContract from '../../snapshots/b28f1a0b27873d1cffbbacf0a0c70333479aeb1086cbbd60571910cab9b48052/contract.json' with { type: 'json' };
import { Migration, MigrationCLI } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addUnique({
        schema: 'public',
        table: 'postMedia',
        constraint: 'postMedia_publicId_key',
        columns: ['publicId'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
