import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { GatewayModule } from "../gateway/gateway.module.js";
import { MediaModule } from "../media/media.module.js";
import { MessageMediaService } from "./message-media.service.js";
import { MessagingController } from "./messaging.controller.js";
import { MessagingRepository } from "./messaging.repository.js";
import { MessagingService } from "./messaging.service.js";

@Module({
  imports: [AuthModule, GatewayModule, MediaModule],
  controllers: [MessagingController],
  providers: [MessagingRepository, MessagingService, MessageMediaService],
})
export class MessagingModule {}
