import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { GatewayModule } from "../gateway/gateway.module.js";
import { MessagingController } from "./messaging.controller.js";
import { MessagingRepository } from "./messaging.repository.js";
import { MessagingService } from "./messaging.service.js";

@Module({
  imports: [AuthModule, GatewayModule],
  controllers: [MessagingController],
  providers: [MessagingRepository, MessagingService],
})
export class MessagingModule {}
