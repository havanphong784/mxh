import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service.js";
import { NotificationsController } from "./notifications.controller.js";
import { NotificationsListener } from "./notifications.listener.js";
import { NotificationsRepository } from "./notifications.repository.js";
import { AuthModule } from "../auth/auth.module.js";
import { GatewayModule } from "../gateway/gateway.module.js";
import { UsersModule } from "../users/users.module.js";

@Module({
  imports: [AuthModule, GatewayModule, UsersModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsListener,
    NotificationsRepository,
  ],
  exports: [NotificationsService, NotificationsRepository],
})
export class NotificationsModule {}
