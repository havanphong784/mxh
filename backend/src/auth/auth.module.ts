import { forwardRef, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MailModule } from "../mail/mail.module.js";
import { UsersModule } from "../users/users.module.js";
import { AccessSessionService } from "./access-session.service.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";
import { JwtAuthGuard } from "./guards/jwt-auth.guard.js";
import { OptionalJwtAuthGuard } from "./guards/optional-jwt-auth.guard.js";

@Module({
  imports: [MailModule, JwtModule.register({}), forwardRef(() => UsersModule)],
  controllers: [AuthController],
  providers: [AuthService, AccessSessionService, JwtAuthGuard, OptionalJwtAuthGuard],
  exports: [AuthService, AccessSessionService, JwtAuthGuard, OptionalJwtAuthGuard, JwtModule],
})
export class AuthModule {}
