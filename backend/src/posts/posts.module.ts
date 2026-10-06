import {Module} from '@nestjs/common';
import {PostsService} from './posts.service.js';
import {PostsController} from './posts.controller.js';
import {MediaModule} from '../media/media.module.js';

@Module({
  imports: [MediaModule],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
