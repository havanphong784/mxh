import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
    constructor(private readonly prisma: PrismaService) {}

    getHealthCheck() {
        return {
            status: 'ok',
            message: 'Backend with NestJS & Fastify is running!',
            timestamp: new Date().toISOString(),
        };
    }
}