import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { AuthModule } from "./auth/auth.module.js";
import { TieredThrottlerGuard } from "./common/guards/tiered-throttler.guard.js";
import { IdempotencyInterceptor } from "./common/idempotency/idempotency.interceptor.js";
import { IdempotencyService } from "./common/idempotency/idempotency.service.js";
import { envValidationSchema } from "./config/env.validation.js";
import { GatewayModule } from "./gateway/gateway.module.js";
import { MediaModule } from "./media/media.module.js";
import { MessagingModule } from "./messaging/messaging.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { PostsModule } from "./posts/posts.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { UsersModule } from "./users/users.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthModule,
    MediaModule,
    UsersModule,
    GatewayModule,
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60000,
        limit: 100,
      },
    ]),
    PostsModule,
    NotificationsModule,
    MessagingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    IdempotencyService,
    {
      provide: APP_GUARD,
      useClass: TieredThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
})
export class AppModule {}
