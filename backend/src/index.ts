import "reflect-metadata";
import { Temporal } from "@js-temporal/polyfill";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "./app.module.js";
import "dotenv/config";
import fastifyCookie from "@fastify/cookie";
import { ValidationPipe } from "@nestjs/common";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter.js";
import { ConfigService } from "@nestjs/config";
import type { EnvironmentVariables } from "./config/env.validation.js";

(globalThis as any).Temporal = Temporal;

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const configService =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  app.enableCors({
    origin:
      configService.get("CORS_ORIGIN", { infer: true }) ||
      "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  await app.register(fastifyCookie as any, {
    secret: configService.get("COOKIE_SECRET", { infer: true }),
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableShutdownHooks();
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = configService.get("PORT", { infer: true }) || 5000;
  await app.listen(port, "0.0.0.0");
  console.log(`🚀 Backend NestJS running on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error("Error starting backend:", err);
  process.exit(1);
});
