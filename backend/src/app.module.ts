import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module.js";
import { AppController } from "./app.controller.js";
import { AppService } from "./app.service.js";
import { AuthModule } from "./auth/auth.module.js";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { MediaModule } from "./media/media.module.js";
import { UsersModule } from "./users/users.module.js";
import { PostsModule } from "./posts/posts.module.js";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { GatewayModule } from "./gateway/gateway.module.js";
import { TieredThrottlerGuard } from "./common/guards/tiered-throttler.guard.js";

@Module({
  imports: [
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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: TieredThrottlerGuard,
    },
  ],
})
export class AppModule {}
