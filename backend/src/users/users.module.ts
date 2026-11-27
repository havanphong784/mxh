import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { MediaModule } from "../media/media.module.js";
import { PostsModule } from "../posts/posts.module.js";
import { UsersController } from "./users.controller.js";
import { UsersRepository } from "./users.repository.js";
import { UsersService } from "./users.service.js";
import { UsersAuthService } from "./users-auth.service.js";

@Module({
  imports: [
    forwardRef(() => AuthModule),
    forwardRef(() => MediaModule),
    forwardRef(() => PostsModule),
  ],
  controllers: [UsersController],
  providers: [UsersService, UsersAuthService, UsersRepository],
  exports: [UsersService, UsersAuthService],
})
export class UsersModule {}
