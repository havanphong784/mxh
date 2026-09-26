import {Module} from '@nestjs/common';
import {AuthService} from './auth.service.js';
import {AuthController} from './auth.controller.js';
import {MailModule} from '../mail/mail.module.js';
import {JwtModule} from "@nestjs/jwt";
import {JwtAuthGuard} from "./guards/jwt-auth.guard.js";
import {OptionalJwtAuthGuard} from "./guards/optional-jwt-auth.guard.js";

@Module({
  imports: [MailModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, OptionalJwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, OptionalJwtAuthGuard, JwtModule],
})
export class AuthModule {}
