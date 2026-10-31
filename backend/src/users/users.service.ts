import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { MediaService } from "../media/media.service.js";
import { UpdateProfileDto } from "./dto/update-profile.dto.js";
import { ChangePasswordDto } from "./dto/change-password.dto.js";
import { FollowPaginationDto } from "./dto/follow-pagination.dto.js";
import * as argon2 from "argon2";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AUTH_EVENTS, USER_EVENTS } from "../events/event-types.js";
import type {
  UserFollowedEvent,
  UserSessionsRevokedEvent,
} from "../events/event-types.js";
import {
  DomainException,
  ERROR_CODES,
} from "../common/exceptions/domain.exception.js";
import { Temporal } from "@js-temporal/polyfill";
import { UsersRepository } from "./users.repository.js";
import type { FollowPaginatedResponseDto } from "./dto/user-response.dto.js";

@Injectable()
export class UsersService {
  constructor(
    private readonly repo: UsersRepository,
    private readonly mediaService: MediaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async searchUsers(term: string, cursor?: string, requestedLimit = 20) {
    const limit = Math.min(50, Math.max(1, Number(requestedLimit) || 20));
    const { byUsername, byDisplayName } = await this.repo.searchActiveUsers(term, cursor, limit);
    const users = [
      ...new Map(
        [...byUsername, ...byDisplayName].map((user) => [user.id, user]),
      ).values(),
    ].sort((a, b) =>
      a.username < b.username ? -1 : a.username > b.username ? 1 : 0,
    );
    const page = users.slice(0, limit);
    return {
      items: page.map((user) => ({
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
      })),
      nextCursor: users.length > limit ? page[page.length - 1].username : null,
    };
  }

  async suggestUsers(viewerId?: string) {
    const candidates = await this.repo.findSuggestionCandidates();
    const candidateIds = candidates.map((user) => user.id);
    const follows =
      viewerId && candidateIds.length > 0
        ? await this.repo.findFollowsToCandidates(viewerId, candidateIds)
        : [];
    const followedIds = new Set(follows.map((follow) => follow.followingId));
    return {
      items: candidates
        .filter((user) => user.id !== viewerId && !followedIds.has(user.id))
        .slice(0, 6)
        .map((user) => ({
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          bio: user.bio,
        })),
    };
  }

  async getMyProfile(userId: string) {
    const user = await this.repo.findById(userId);

    if (!user || !user.isActive) {
      throw new NotFoundException(
        "Người dùng không tồn tại hoặc tài khoản đã bị khóa",
      );
    }

    const [followersCount, followingCount] = await Promise.all([
      this.repo.countFollowers(user.id),
      this.repo.countFollowing(user.id),
    ]);

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      avatarPublicId: user.avatarPublicId,
      bannerUrl: user.bannerUrl,
      bannerPublicId: user.bannerPublicId,
      followersCount,
      followingCount,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    };
  }

  async getPublicProfile(username: string, currentUserId?: string) {
    const user = await this.repo.findByUsername(username);

    if (!user || !user.isActive || !user.isEmailVerified) {
      throw new NotFoundException(
        "Người dùng không tồn tại hoặc tài khoản đã bị khóa",
      );
    }

    const [followersCount, followingCount, followRecord] = await Promise.all([
      this.repo.countFollowers(user.id),
      this.repo.countFollowing(user.id),
      currentUserId && currentUserId !== user.id
        ? this.repo.findFollow(currentUserId, user.id)
        : Promise.resolve(null),
    ]);
    const isFollowing = !!followRecord;

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      followersCount,
      followingCount,
      isFollowing,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const currentUser = await this.repo.findById(userId);

    if (!currentUser || !currentUser.isActive) {
      throw new NotFoundException("Người dùng không tồn tại hoặc đã bị khóa");
    }

    const expectedAvatarPrefix = `mxh/${userId}/avatars/`;
    if (
      dto.avatarPublicId &&
      !dto.avatarPublicId.startsWith(expectedAvatarPrefix)
    ) {
      throw new BadRequestException(
        "avatarPublicId không hợp lệ hoặc không thuộc quyền sở hữu của bạn",
      );
    }

    const expectedBannerPrefix = `mxh/${userId}/banners/`;
    if (
      dto.bannerPublicId &&
      !dto.bannerPublicId.startsWith(expectedBannerPrefix)
    ) {
      throw new BadRequestException(
        "bannerPublicId không hợp lệ hoặc không thuộc quyền sở hữu của bạn",
      );
    }

    const avatarPublicIdToDelete =
      currentUser.avatarPublicId &&
      dto.avatarPublicId !== undefined &&
      dto.avatarPublicId !== currentUser.avatarPublicId &&
      (currentUser.avatarPublicId.startsWith(expectedAvatarPrefix) ||
        currentUser.avatarPublicId.startsWith("mxh/avatars/"))
        ? currentUser.avatarPublicId
        : null;

    const bannerPublicIdToDelete =
      currentUser.bannerPublicId &&
      dto.bannerPublicId !== undefined &&
      dto.bannerPublicId !== currentUser.bannerPublicId &&
      (currentUser.bannerPublicId.startsWith(expectedBannerPrefix) ||
        currentUser.bannerPublicId.startsWith("mxh/banners/"))
        ? currentUser.bannerPublicId
        : null;

    const updatePayload: Record<string, any> = {};
    if (dto.displayName !== undefined)
      updatePayload.displayName = dto.displayName;
    if (dto.bio !== undefined) updatePayload.bio = dto.bio;
    if (dto.avatarUrl !== undefined) updatePayload.avatarUrl = dto.avatarUrl;
    if (dto.avatarPublicId !== undefined)
      updatePayload.avatarPublicId = dto.avatarPublicId;
    if (dto.bannerUrl !== undefined) updatePayload.bannerUrl = dto.bannerUrl;
    if (dto.bannerPublicId !== undefined)
      updatePayload.bannerPublicId = dto.bannerPublicId;

    if (Object.keys(updatePayload).length > 0) {
      await this.repo.updateUser(userId, updatePayload);
    }

    await Promise.all([
      this.mediaService.deleteFile(avatarPublicIdToDelete),
      this.mediaService.deleteFile(bannerPublicIdToDelete),
    ]);

    const updatedUser = await this.repo.findById(userId);

    if (!updatedUser) {
      throw new NotFoundException("Không tìm thấy người dùng");
    }

    const [followersCount, followingCount] = await Promise.all([
      this.repo.countFollowers(userId),
      this.repo.countFollowing(userId),
    ]);

    return {
      id: updatedUser.id,
      email: updatedUser.email,
      username: updatedUser.username,
      displayName: updatedUser.displayName,
      bio: updatedUser.bio,
      avatarUrl: updatedUser.avatarUrl,
      avatarPublicId: updatedUser.avatarPublicId,
      bannerUrl: updatedUser.bannerUrl,
      bannerPublicId: updatedUser.bannerPublicId,
      followersCount,
      followingCount,
      isEmailVerified: updatedUser.isEmailVerified,
      createdAt: updatedUser.createdAt,
    };
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    currentSessionId?: string,
  ) {
    const user = await this.repo.findById(userId);

    if (!user || !user.isActive) {
      throw new NotFoundException("Người dùng không tồn tại hoặc đã bị khóa");
    }

    const isMatch = await argon2.verify(user.passwordHash, dto.oldPassword);
    if (!isMatch) {
      throw new BadRequestException("Mật khẩu hiện tại không chính xác");
    }

    if (dto.oldPassword === dto.newPassword) {
      throw new BadRequestException(
        "Mật khẩu mới không được trùng với mật khẩu hiện tại",
      );
    }

    const newPasswordHash = await argon2.hash(dto.newPassword);
    const logoutOtherDevices = dto.logoutOtherDevices ?? true;
    await this.repo.changePasswordAndRevokeSessions(
      userId, newPasswordHash, logoutOtherDevices, currentSessionId,
    );

    if (logoutOtherDevices) {
      this.eventEmitter.emit(AUTH_EVENTS.USER_SESSIONS_REVOKED, {
        userId,
        exceptSessionId: currentSessionId,
      } satisfies UserSessionsRevokedEvent);
    }

    return {
      message: "Đổi mật khẩu thành công",
    };
  }

  async followUser(currentUserId: string, targetUserId: string) {
    const currentUser = await this.repo.findById(currentUserId);

    if (!currentUser || !currentUser.isActive) {
      throw new ForbiddenException(
        "Tài khoản của bạn đã bị khóa hoặc không tồn tại",
      );
    }

    const targetUser = await this.repo.findById(targetUserId);

    if (!targetUser || !targetUser.isActive || !targetUser.isEmailVerified) {
      throw new NotFoundException(
        "Người dùng không tồn tại hoặc tài khoản đã bị khóa",
      );
    }

    if (currentUserId === targetUser.id) {
      throw new BadRequestException("Bạn không thể tự theo dõi chính mình");
    }

    const existingFollow = await this.repo.findFollow(currentUserId, targetUser.id);

    if (existingFollow) {
      throw new BadRequestException("Bạn đã theo dõi người dùng này rồi");
    }

    try {
      await this.repo.createFollow(currentUserId, targetUser.id);
    } catch (error: any) {
      if (
        error?.code === "23505" ||
        error?.message?.includes("duplicate key") ||
        error?.message?.includes("violates unique constraint")
      ) {
        throw new BadRequestException("Bạn đã theo dõi người dùng này rồi");
      }
      throw error;
    }

    this.eventEmitter.emit(USER_EVENTS.FOLLOWED, {
      followerId: currentUserId,
      followingId: targetUser.id,
    } satisfies UserFollowedEvent);

    return {
      message: `Đã theo dõi ${targetUser.displayName}`,
    };
  }

  async unfollowUser(currentUserId: string, targetUserId: string) {
    const currentUser = await this.repo.findById(currentUserId);

    if (!currentUser || !currentUser.isActive) {
      throw new ForbiddenException(
        "Tài khoản của bạn đã bị khóa hoặc không tồn tại",
      );
    }

    const targetUser = await this.repo.findById(targetUserId);

    if (!targetUser) {
      throw new NotFoundException("Người dùng không tồn tại");
    }

    if (currentUserId === targetUser.id) {
      throw new BadRequestException("Thao tác không hợp lệ");
    }

    const existingFollow = await this.repo.findFollow(currentUserId, targetUser.id);

    if (!existingFollow) {
      throw new BadRequestException("Bạn chưa theo dõi người dùng này");
    }

    await this.repo.deleteFollow(currentUserId, targetUser.id);

    return {
      message: "Đã hủy theo dõi thành công",
    };
  }

  async getFollowers(
    username: string,
    query: FollowPaginationDto,
  ): Promise<FollowPaginatedResponseDto> {
    const user = await this.repo.findByUsername(username);

    if (!user || !user.isActive || !user.isEmailVerified) {
      throw new NotFoundException(
        "Người dùng không tồn tại hoặc tài khoản đã bị khóa",
      );
    }

    const limit = Math.min(50, Math.max(1, Number(query?.limit) || 20));
    const cursor = this.decodeFollowCursor(query?.cursor);

    if (cursor) {
      const follows = await this.repo.listFollowers(user.id, { cursor, limit: limit + 1 });

      const hasNextPage = follows.length > limit;
      const items = hasNextPage ? follows.slice(0, limit) : follows;
      const nextCursor =
        hasNextPage && items.length > 0
          ? this.encodeFollowCursor({
              createdAt: items[items.length - 1].createdAt,
              id: items[items.length - 1].followerId,
            })
          : null;

      const total = await this.repo.countFollowers(user.id);

      return {
        items: items.map((f: any) => ({
          id: f.follower.id,
          username: f.follower.username,
          displayName: f.follower.displayName,
          avatarUrl: f.follower.avatarUrl,
          bio: f.follower.bio,
        })),
        nextCursor,
        meta: {
          total,
          page: 1,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    const page = Math.max(1, Number(query?.page) || 1);
    const skip = (page - 1) * limit;

    const [total, follows] = await Promise.all([
      this.repo.countFollowers(user.id),
      this.repo.listFollowers(user.id, { offset: skip, limit }),
    ]);
    const nextCursor =
      follows.length === limit && skip + limit < total
        ? this.encodeFollowCursor({
            createdAt: follows[follows.length - 1].createdAt,
            id: follows[follows.length - 1].followerId,
          })
        : null;

    return {
      items: follows.map((f: any) => ({
        id: f.follower.id,
        username: f.follower.username,
        displayName: f.follower.displayName,
        avatarUrl: f.follower.avatarUrl,
        bio: f.follower.bio,
      })),
      nextCursor,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFollowing(
    username: string,
    query: FollowPaginationDto,
  ): Promise<FollowPaginatedResponseDto> {
    const user = await this.repo.findByUsername(username);

    if (!user || !user.isActive || !user.isEmailVerified) {
      throw new NotFoundException(
        "Người dùng không tồn tại hoặc tài khoản đã bị khóa",
      );
    }

    const limit = Math.min(50, Math.max(1, Number(query?.limit) || 20));
    const cursor = this.decodeFollowCursor(query?.cursor);

    if (cursor) {
      const follows = await this.repo.listFollowing(user.id, { cursor, limit: limit + 1 });

      const hasNextPage = follows.length > limit;
      const items = hasNextPage ? follows.slice(0, limit) : follows;
      const nextCursor =
        hasNextPage && items.length > 0
          ? this.encodeFollowCursor({
              createdAt: items[items.length - 1].createdAt,
              id: items[items.length - 1].followingId,
            })
          : null;

      const total = await this.repo.countFollowing(user.id);

      return {
        items: items.map((f: any) => ({
          id: f.following.id,
          username: f.following.username,
          displayName: f.following.displayName,
          avatarUrl: f.following.avatarUrl,
          bio: f.following.bio,
        })),
        nextCursor,
        meta: {
          total,
          page: 1,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    const page = Math.max(1, Number(query?.page) || 1);
    const skip = (page - 1) * limit;

    const [total, follows] = await Promise.all([
      this.repo.countFollowing(user.id),
      this.repo.listFollowing(user.id, { offset: skip, limit }),
    ]);
    const nextCursor =
      follows.length === limit && skip + limit < total
        ? this.encodeFollowCursor({
            createdAt: follows[follows.length - 1].createdAt,
            id: follows[follows.length - 1].followingId,
          })
        : null;

    return {
      items: follows.map((f: any) => ({
        id: f.following.id,
        username: f.following.username,
        displayName: f.following.displayName,
        avatarUrl: f.following.avatarUrl,
        bio: f.following.bio,
      })),
      nextCursor,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private encodeFollowCursor(item: { createdAt: any; id: string }): string {
    return Buffer.from(
      JSON.stringify({
        createdAt: item.createdAt.toString(),
        id: item.id,
      }),
    ).toString("base64url");
  }

  private decodeFollowCursor(
    cursor?: string,
  ): { createdAt: Temporal.Instant; id: string } | null {
    if (!cursor) return null;
    try {
      const decoded = JSON.parse(
        Buffer.from(cursor, "base64url").toString("utf8"),
      );
      if (
        typeof decoded?.createdAt !== "string" ||
        typeof decoded?.id !== "string" ||
        !decoded.id
      ) {
        return null;
      }
      return {
        createdAt: Temporal.Instant.from(decoded.createdAt),
        id: decoded.id,
      };
    } catch {
      return null;
    }
  }

  // ==========================================
  // Public Facade Methods for other Modules
  // (Adhering to Single Table Ownership)
  // ==========================================

  async ensureActiveUser(userId: string) {
    const user = await this.repo.findById(userId);

    if (!user || !user.isActive) {
      throw new DomainException(
        ERROR_CODES.AUTH_ACCOUNT_LOCKED,
        "Tài khoản của bạn đã bị khóa hoặc không tồn tại",
        HttpStatus.FORBIDDEN,
      );
    }

    if (!user.isEmailVerified) {
      throw new DomainException(
        ERROR_CODES.AUTH_EMAIL_UNVERIFIED,
        "Vui lòng xác thực email để thực hiện hành động này",
        HttpStatus.FORBIDDEN,
      );
    }

    return { id: user.id };
  }

  async getAuthProfile(userId: string) {
    const user = await this.repo.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException("Tài khoản không tồn tại hoặc đã bị khóa.");
    }
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
      bio: user.bio,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    };
  }

  async getAccessSessionState(sessionId: string) {
    const session = await this.repo.findAccessSession(sessionId);
    if (!session) return null;
    return {
      userId: session.userId,
      isRevoked: session.isRevoked,
      expiresAt: session.expiresAt,
      isActive: session.user.isActive,
      isEmailVerified: session.user.isEmailVerified,
    };
  }

  async findActiveUserById(userId: string) {
    const user = await this.repo.findById(userId);

    if (!user || !user.isActive || !user.isEmailVerified) {
      return null;
    }

    return this.toPublicUser(user);
  }

  async findActiveUserByUsername(username: string) {
    const user = await this.repo.findByUsername(username);

    if (!user || !user.isActive || !user.isEmailVerified) {
      throw new DomainException(
        ERROR_CODES.USER_NOT_FOUND,
        "Không tìm thấy người dùng",
        HttpStatus.NOT_FOUND,
      );
    }

    return this.toPublicUser(user);
  }

  async isFollowing(followerId: string, followingId: string): Promise<boolean> {
    return !!(await this.repo.findFollow(followerId, followingId));
  }

  async getActiveFollowingIds(followerId: string): Promise<string[]> {
    return this.repo.findActiveFollowingIds(followerId);
  }

  async getFollowerIds(followingId: string): Promise<string[]> {
    return this.repo.findFollowerIds(followingId);
  }

  private toPublicUser(user: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    bio: string | null;
    isActive: boolean;
    isEmailVerified: boolean;
  }) {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
    };
  }
}
