import {Module} from "@nestjs/common";
import {PrismaModule} from "./prisma/prisma.module.js";
import {AppController} from "./app.controller.js";
import {AppService} from "./app.service.js";
import {AuthModule} from "./auth/auth.module.js";
import {ThrottlerGuard, ThrottlerModule} from "@nestjs/throttler";
import {APP_GUARD} from "@nestjs/core";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: 60000,
        limit: 60,
      },
    ]),
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
