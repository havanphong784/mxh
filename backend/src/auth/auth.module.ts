import {Module} from '@nestjs/common';
import {AuthService} from './auth.service.js';
import {AuthController} from './auth.controller.js';
import {MailModule} from '../mail/mail.module.js';
import {JwtModule} from "@nestjs/jwt";

@Module({
  imports: [MailModule,JwtModule.register({})],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}