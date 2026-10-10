import {Module} from "@nestjs/common";
import {PrismaModule} from "./prisma/prisma.module.js";
import {AppController} from "./app.controller.js";
import {AppService} from "./app.service.js";
import {AuthModule} from "./auth/auth.module.js";
import {ThrottlerGuard, ThrottlerModule} from "@nestjs/throttler";
import {APP_GUARD} from "@nestjs/core";
import {MediaModule} from "./media/media.module.js";
import {UsersModule} from "./users/users.module.js";
import {PostsModule} from "./posts/posts.module.js";
import {EventEmitterModule} from "@nestjs/event-emitter";

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthModule,
    MediaModule,
    UsersModule,
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60000,
        limit: 60,
      },
    ]),
    PostsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
