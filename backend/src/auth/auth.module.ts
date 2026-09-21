import {Module} from '@nestjs/common';
import {AuthService} from './auth.service.js';
import {AuthController} from './auth.controller.js';
import {MailModule} from '../mail/mail.module.js';

@Module({
  imports: [MailModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}