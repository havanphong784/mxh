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
import { UsersService } from "./users.service.js";
import { PostsService } from "../posts/posts.service.js";
import { UpdateProfileDto } from "./dto/update-profile.dto.js";
import { ChangePasswordDto } from "./dto/change-password.dto.js";
import { FollowPaginationDto } from "./dto/follow-pagination.dto.js";
import { CursorPaginationDto } from "../posts/dto/cursor-pagination.dto.js";
import { SearchQueryDto } from "../common/dto/search-query.dto.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { OptionalJwtAuthGuard } from "../auth/guards/optional-jwt-auth.guard.js";
import { CurrentUser } from "../auth/decorators/current-user.decorator.js";

@Controller("users")
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly postsService: PostsService,
  ) {}

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async getMyProfile(@CurrentUser("sub") userId: string) {
    return this.usersService.getMyProfile(userId);
  }

  @Get("search")
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async searchUsers(@Query() query: SearchQueryDto) {
    return this.usersService.searchUsers(query.q, query.cursor, query.limit);
  }

  @Get("suggestions")
  @UseGuards(OptionalJwtAuthGuard)
  async suggestUsers(@CurrentUser("sub") viewerId?: string) {
    return this.usersService.suggestUsers(viewerId);
  }

  @Get(":username")
  @UseGuards(OptionalJwtAuthGuard)
  async getPublicProfile(
    @Param("username") username: string,
    @CurrentUser("sub") currentUserId?: string,
  ) {
    return this.usersService.getPublicProfile(username, currentUserId);
  }

  @Post(":id/follow")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async follow(
    @CurrentUser("sub") currentUserId: string,
    @Param("id") targetUserId: string,
  ) {
    return this.usersService.followUser(currentUserId, targetUserId);
  }

  @Delete(":id/follow")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  async unfollow(
    @CurrentUser("sub") currentUserId: string,
    @Param("id") targetUserId: string,
  ) {
    return this.usersService.unfollowUser(currentUserId, targetUserId);
  }

  @Get(":username/followers")
  async getFollowers(
    @Param("username") username: string,
    @Query() query: FollowPaginationDto,
  ) {
    return this.usersService.getFollowers(username, query);
  }

  @Get(":username/following")
  async getFollowing(
    @Param("username") username: string,
    @Query() query: FollowPaginationDto,
  ) {
    return this.usersService.getFollowing(username, query);
  }

  @Get(":username/posts")
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getUserPosts(
    @Param("username") username: string,
    @Query() query: CursorPaginationDto,
    @CurrentUser("sub") viewerId?: string,
  ) {
    return this.postsService.getUserPosts(username, query, viewerId);
  }

  @Get(":username/replies")
  @UseGuards(OptionalJwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  async getUserReplies(
    @Param("username") username: string,
    @Query() query: CursorPaginationDto,
    @CurrentUser("sub") viewerId?: string,
  ) {
    return this.postsService.getUserReplies(username, query, viewerId);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async updateProfile(
    @CurrentUser("sub") userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  @Post("change-password")
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser("sub") userId: string,
    @CurrentUser("sessionId") currentSessionId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.usersService.changePassword(userId, dto, currentSessionId);
  }
}
