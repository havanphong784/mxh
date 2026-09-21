import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import {
    FastifyAdapter,
    NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import 'dotenv/config';
import fastifyCookie from "@fastify/cookie";
import {ValidationPipe} from "@nestjs/common";

async function bootstrap() {
    const app = await NestFactory.create<NestFastifyApplication>(
        AppModule,
        new FastifyAdapter({ logger: true })
    );

    await app.register(fastifyCookie as any,{secret: process.env.COOKIE_SECRET || 'cookies-secret'});
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            forbidNonWhitelisted: true,
            transform: true,
        })
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