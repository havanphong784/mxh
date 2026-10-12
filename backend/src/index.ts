import "reflect-metadata";
import {Temporal} from "@js-temporal/polyfill";
import {NestFactory} from "@nestjs/core";
import {FastifyAdapter, NestFastifyApplication,} from "@nestjs/platform-fastify";
import {AppModule} from "./app.module.js";
import "dotenv/config";
import fastifyCookie from "@fastify/cookie";
import {ValidationPipe} from "@nestjs/common";
import {AllExceptionsFilter} from "./common/filters/all-exceptions.filter.js";

(globalThis as any).Temporal = Temporal;

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  await app.register(fastifyCookie as any, {
    secret: process.env.COOKIE_SECRET || "cookies-secret",
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

  const port = process.env.PORT || 3000;
  await app.listen(port, "0.0.0.0");
  console.log(`🚀 Backend NestJS running on http://localhost:${port}`);
}

bootstrap().catch((err) => {
  console.error("Error starting backend:", err);
  process.exit(1);
});
