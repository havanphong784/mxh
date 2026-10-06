import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {Throttle} from '@nestjs/throttler';
import {PostsService} from './posts.service.js';
import {CreatePostDto} from './dto/create-post.dto.js';
import {UpdatePostDto} from './dto/update-post.dto.js';
import {JwtAuthGuard} from '../auth/guards/jwt-auth.guard.js';
import {OptionalJwtAuthGuard} from '../auth/guards/optional-jwt-auth.guard.js';
import {CurrentUser} from '../auth/decorators/current-user.decorator.js';
import {CursorPaginationDto} from "./dto/cursor-pagination.dto.js";

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async createPost(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.postsService.createPost(userId, dto);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getPostById(
    @Param('id') postId: string,
    @CurrentUser('sub') viewerId?: string,
  ) {
    return this.postsService.getPostById(postId, viewerId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  async updatePost(
    @Param('id') postId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.updatePost(postId, userId, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async deletePost(
    @Param('id') postId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.postsService.deletePost(postId, userId);
  }

  @Get(':id/replies')
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getReplies(
      @Param('id') postId: string,
      @Query() query: CursorPaginationDto,
      @CurrentUser('sub') viewerId?: string,
  ) {
    return this.postsService.getReplies(postId, query, viewerId);
  }

  @Get(':id/ancestors')
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getAncestors(
      @Param('id') postId: string,
      @CurrentUser('sub') viewerId?: string,
  ) {
    return this.postsService.getAncestors(postId, viewerId);
  }
}
