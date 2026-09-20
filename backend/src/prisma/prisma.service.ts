import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import {db} from "./db.js";

@Injectable()
export class PrismaService implements OnModuleInit,OnModuleDestroy {
    public readonly client = db;

    async onModuleInit() {
        await this.client.connect();
    }

    async onModuleDestroy() {
        await this.client.close();
    }
}
