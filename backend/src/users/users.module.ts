import { Module } from '@nestjs/common';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';
import { MediaModule } from '../media/media.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule, MediaModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
