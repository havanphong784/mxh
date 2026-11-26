import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { MediaModule } from "../media/media.module.js";
import { UsersModule } from "../users/users.module.js";
import { PostsController } from "./posts.controller.js";
import { PostsRepository } from "./posts.repository.js";
import { PostsService } from "./posts.service.js";

@Module({
  imports: [
    forwardRef(() => MediaModule),
    forwardRef(() => AuthModule),
    forwardRef(() => UsersModule),
  ],
  controllers: [PostsController],
  providers: [PostsService, PostsRepository],
  exports: [PostsService],
})
export class PostsModule {}
