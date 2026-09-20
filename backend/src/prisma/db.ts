import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import contractJson from './contract.json' with { type: 'json' };
import {Contract} from "./contract.js";

export const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
});


// Option mặc định của db
// connectionTimeoutMillis 20000s
// idleTimeoutMillis: 30000s neu mot connection trong pool k co query nao trong hon 30 giay thi se bi close