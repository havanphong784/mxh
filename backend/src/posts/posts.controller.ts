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
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { PostsService } from "./posts.service.js";
import { CreatePostDto } from "./dto/create-post.dto.js";
import { UpdatePostDto } from "./dto/update-post.dto.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import { CursorPaginationDto } from "./dto/cursor-pagination.dto.js";
import { OffsetPaginationDto } from "./dto/offset-pagination.dto.js";
import { SearchQueryDto } from "../common/dto/search-query.dto.js";
import { ExploreQueryDto } from "./dto/explore-query.dto.js";

@Controller("posts")
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @HttpCode(HttpStatus.CREATED)
  async createPost(
    @CurrentUser("sub") userId: string,
    @Body() dto: CreatePostDto,
  ) {
    return this.postsService.createPost(userId, dto);
  }

  @Get("feed")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getFeed(
    @CurrentUser("sub") userId: string,
    @Query() query: CursorPaginationDto,
  ) {
    return this.postsService.getFeed(userId, query);
  }

  @Get("explore")
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getExplore(
    @Query() query: ExploreQueryDto,
    @CurrentUser("sub") viewerId?: string,
  ) {
    return this.postsService.getExplore(query, viewerId);
  }

  @Get("search")
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async searchPosts(
    @Query() query: SearchQueryDto,
    @CurrentUser("sub") viewerId?: string,
  ) {
    return this.postsService.getExplore(query, viewerId, query.q);
  }

  @Get("bookmarks")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getBookmarks(
    @CurrentUser("sub") userId: string,
    @Query() query: CursorPaginationDto,
  ) {
    return this.postsService.getBookmarks(userId, query);
  }

  @Get("liked")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getLikedPosts(
    @CurrentUser("sub") userId: string,
    @Query() query: CursorPaginationDto,
  ) {
    return this.postsService.getLikedPosts(userId, query);
  }

  @Get(":id")
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getPostById(
    @Param("id") postId: string,
    @CurrentUser("sub") viewerId?: string,
  ) {
    return this.postsService.getPostById(postId, viewerId);
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  async updatePost(
    @Param("id") postId: string,
    @CurrentUser("sub") userId: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.updatePost(postId, userId, dto);
  }

  @Delete(":id")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async deletePost(
    @Param("id") postId: string,
    @CurrentUser("sub") userId: string,
  ) {
    return this.postsService.deletePost(postId, userId);
  }

  @Get(":id/replies")
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getReplies(
    @Param("id") postId: string,
    @Query() query: CursorPaginationDto,
    @CurrentUser("sub") viewerId?: string,
  ) {
    return this.postsService.getReplies(postId, query, viewerId);
  }

  @Get(":id/ancestors")
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getAncestors(
    @Param("id") postId: string,
    @CurrentUser("sub") viewerId?: string,
  ) {
    return this.postsService.getAncestors(postId, viewerId);
  }

  @Post(":id/repost")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async repost(
    @Param("id") postId: string,
    @CurrentUser("sub") userId: string,
  ) {
    return this.postsService.repost(postId, userId);
  }

  @Delete(":id/repost")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async unrepost(
    @Param("id") postId: string,
    @CurrentUser("sub") userId: string,
  ) {
    return this.postsService.unrepost(postId, userId);
  }

  @Post(":id/like")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async likePost(
    @Param("id") postId: string,
    @CurrentUser("sub") userId: string,
  ) {
    return this.postsService.likePost(postId, userId);
  }

  @Delete(":id/like")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlikePost(
    @Param("id") postId: string,
    @CurrentUser("sub") userId: string,
  ) {
    return this.postsService.unlikePost(postId, userId);
  }

  @Get(":id/likes")
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getPostLikes(
    @Param("id") postId: string,
    @Query() query: OffsetPaginationDto,
    @CurrentUser("sub") viewerId?: string,
  ) {
    return this.postsService.getPostLikes(postId, query, viewerId);
  }

  @Post(":id/bookmark")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async bookmarkPost(
    @Param("id") postId: string,
    @CurrentUser("sub") userId: string,
  ) {
    return this.postsService.bookmarkPost(postId, userId);
  }

  @Delete(":id/bookmark")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async unbookmarkPost(
    @Param("id") postId: string,
    @CurrentUser("sub") userId: string,
  ) {
    return this.postsService.unbookmarkPost(postId, userId);
  }
}
