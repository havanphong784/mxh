import { forwardRef, Module } from "@nestjs/common";
import { PostsService } from "./posts.service.js";
import { PostsController } from "./posts.controller.js";
import { PostsRepository } from "./posts.repository.js";
import { MediaModule } from "../media/media.module.js";
import { AuthModule } from "../auth/auth.module.js";
import { UsersModule } from "../users/users.module.js";

@Module({
  imports: [MediaModule, AuthModule, forwardRef(() => UsersModule)],
  controllers: [PostsController],
  providers: [PostsService, PostsRepository],
  exports: [PostsService, PostsRepository],
})
export class PostsModule {}
