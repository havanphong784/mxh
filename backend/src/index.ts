import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
    FastifyAdapter,
    NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import 'dotenv/config';

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter({ logger: true })
    );

    app.enableShutdownHooks();
    app.setGlobalPrefix('api/v1');

    const port = process.env.PORT || 3000 || 30001;
    await app.listen(port, '0.0.0.0');
    console.log(`🚀 Backend NestJS running on http://localhost:${port}`);
}

bootstrap().catch((err) => {
    console.error('Error starting backend:', err);
    process.exit(1);
});