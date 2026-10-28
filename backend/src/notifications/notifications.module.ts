import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service.js";
import { NotificationsController } from "./notifications.controller.js";
import { NotificationsListener } from "./notifications.listener.js";
import { AuthModule } from "../auth/auth.module.js";
import { GatewayModule } from "../gateway/gateway.module.js";
import { UsersModule } from "../users/users.module.js";

@Module({
  imports: [AuthModule, GatewayModule, UsersModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsListener],
  exports: [NotificationsService],
})
export class NotificationsModule {}
