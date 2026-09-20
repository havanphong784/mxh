import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import contractJson from './contract.json' with { type: 'json' };
import {Contract} from "./contract";

export const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
});
