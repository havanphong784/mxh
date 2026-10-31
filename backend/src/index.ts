import "reflect-metadata";
import * as crypto from "node:crypto";
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

declare global {
  var Temporal: typeof import("@js-temporal/polyfill").Temporal;
}
globalThis.Temporal = Temporal;

async function bootstrap() {
  const cookieSecret = process.env.COOKIE_SECRET;
  if (!cookieSecret || cookieSecret.length < 32) {
    throw new Error("COOKIE_SECRET must contain at least 32 characters");
  }

  const adapter = new FastifyAdapter({
    logger: true,
    requestIdHeader: "x-request-id",
    genReqId: (req: {
      headers: Record<string, string | string[] | undefined>;
    }) => {
      const existingId = req.headers["x-request-id"];
      if (typeof existingId === "string" && existingId.trim().length > 0) {
        return existingId.trim();
      }
      return crypto.randomUUID();
    },
  });

  adapter.getInstance().addHook("onSend", async (request, reply) => {
    reply.header("x-request-id", request.id);
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
  );

  const configService =
    app.get<ConfigService<EnvironmentVariables, true>>(ConfigService);

  app.enableCors({
    origin: configService.get("CORS_ORIGIN", { infer: true }),
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-request-id",
      "Idempotency-Key",
    ],
    exposedHeaders: ["x-request-id"],
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

  const port = configService.get("PORT", { infer: true });
  await app.listen(port, "0.0.0.0");
  console.log(`🚀 Backend NestJS running on http://localhost:${port}`);
}

bootstrap().catch((err: unknown) => {
  console.error("Error starting backend:", err);
  process.exit(1);
});
