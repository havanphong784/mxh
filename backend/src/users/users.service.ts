import {BadRequestException, ForbiddenException, Injectable, NotFoundException,} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service.js';
import {MediaService} from '../media/media.service.js';
import {UpdateProfileDto} from './dto/update-profile.dto.js';
import {ChangePasswordDto} from './dto/change-password.dto.js';
import {FollowPaginationDto} from './dto/follow-pagination.dto.js';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async getMyProfile(userId: string) {
    const user = await this.prisma.client.orm.public.User
      .where((u) => u.id.eq(userId))
      .first();

    if (!user || !user.isActive) {
      throw new NotFoundException('Người dùng không tồn tại hoặc tài khoản đã bị khóa');
    }

    const [followersAgg, followingAgg] = await Promise.all([
      this.prisma.client.orm.public.Follow
        .where((f) => f.followingId.eq(user.id))
        .where((f) => f.follower.some((u) => u.isActive.eq(true)))
        .where((f) => f.follower.some((u) => u.isEmailVerified.eq(true)))
        .aggregate((agg) => ({ total: agg.count() })),
      this.prisma.client.orm.public.Follow
        .where((f) => f.followerId.eq(user.id))
        .where((f) => f.following.some((u) => u.isActive.eq(true)))
        .where((f) => f.following.some((u) => u.isEmailVerified.eq(true)))
        .aggregate((agg) => ({ total: agg.count() })),
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
      followersCount: Number(followersAgg.total),
      followingCount: Number(followingAgg.total),
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
    };
  }

  async getPublicProfile(username: string, currentUserId?: string) {
    const user = await this.prisma.client.orm.public.User
      .where((u) => u.username.eq(username.toLowerCase()))
      .first();

    if (!user || !user.isActive || !user.isEmailVerified) {
      throw new NotFoundException('Người dùng không tồn tại hoặc tài khoản đã bị khóa');
    }

    const shouldCheckFollow = !!currentUserId && currentUserId !== user.id;

    const [followersAgg, followingAgg, followRecord] = await Promise.all([
      this.prisma.client.orm.public.Follow
        .where((f) => f.followingId.eq(user.id))
        .where((f) => f.follower.some((u) => u.isActive.eq(true)))
        .where((f) => f.follower.some((u) => u.isEmailVerified.eq(true)))
        .aggregate((agg) => ({ total: agg.count() })),
      this.prisma.client.orm.public.Follow
        .where((f) => f.followerId.eq(user.id))
        .where((f) => f.following.some((u) => u.isActive.eq(true)))
        .where((f) => f.following.some((u) => u.isEmailVerified.eq(true)))
        .aggregate((agg) => ({ total: agg.count() })),
      shouldCheckFollow
        ? this.prisma.client.orm.public.Follow
            .where((f) => f.followerId.eq(currentUserId!))
            .where((f) => f.followingId.eq(user.id))
            .first()
        : Promise.resolve(null),
    ]);

    const followersCount = Number(followersAgg.total);
    const followingCount = Number(followingAgg.total);
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
    const currentUser = await this.prisma.client.orm.public.User
      .where((u) => u.id.eq(userId))
      .first();

    if (!currentUser || !currentUser.isActive) {
      throw new NotFoundException('Người dùng không tồn tại hoặc đã bị khóa');
    }

    const expectedAvatarPrefix = `mxh/${userId}/avatars/`;
    if (dto.avatarPublicId && !dto.avatarPublicId.startsWith(expectedAvatarPrefix)) {
      throw new BadRequestException('avatarPublicId không hợp lệ hoặc không thuộc quyền sở hữu của bạn');
    }

    const expectedBannerPrefix = `mxh/${userId}/banners/`;
    if (dto.bannerPublicId && !dto.bannerPublicId.startsWith(expectedBannerPrefix)) {
      throw new BadRequestException('bannerPublicId không hợp lệ hoặc không thuộc quyền sở hữu của bạn');
    }

    if (
      currentUser.avatarPublicId &&
      dto.avatarPublicId !== undefined &&
      dto.avatarPublicId !== currentUser.avatarPublicId
    ) {
      if (
        currentUser.avatarPublicId.startsWith(expectedAvatarPrefix) ||
        currentUser.avatarPublicId.startsWith('mxh/avatars/')
      ) {
        await this.mediaService.deleteFile(currentUser.avatarPublicId);
      }
    }

    if (
      currentUser.bannerPublicId &&
      dto.bannerPublicId !== undefined &&
      dto.bannerPublicId !== currentUser.bannerPublicId
    ) {
      if (
        currentUser.bannerPublicId.startsWith(expectedBannerPrefix) ||
        currentUser.bannerPublicId.startsWith('mxh/banners/')
      ) {
        await this.mediaService.deleteFile(currentUser.bannerPublicId);
      }
    }

    const updatePayload: Record<string, any> = {};
    if (dto.displayName !== undefined) updatePayload.displayName = dto.displayName;
    if (dto.bio !== undefined) updatePayload.bio = dto.bio;
    if (dto.avatarUrl !== undefined) updatePayload.avatarUrl = dto.avatarUrl;
    if (dto.avatarPublicId !== undefined) updatePayload.avatarPublicId = dto.avatarPublicId;
    if (dto.bannerUrl !== undefined) updatePayload.bannerUrl = dto.bannerUrl;
    if (dto.bannerPublicId !== undefined) updatePayload.bannerPublicId = dto.bannerPublicId;

    if (Object.keys(updatePayload).length > 0) {
      await this.prisma.client.orm.public.User
        .where((u) => u.id.eq(userId))
        .update(updatePayload);
    }

    const updatedUser = await this.prisma.client.orm.public.User
      .where((u) => u.id.eq(userId))
      .first();

    if (!updatedUser) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

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
      createdAt: updatedUser.createdAt,
    };
  }

  async changePassword(userId: string, dto: ChangePasswordDto, currentSessionId?: string) {
    const user = await this.prisma.client.orm.public.User
        .where((u) => u.id.eq(userId))
        .first();

    if (!user || !user.isActive) {
      throw new NotFoundException('Người dùng không tồn tại hoặc đã bị khóa');
    }

    const isMatch = await argon2.verify(user.passwordHash, dto.oldPassword);
    if (!isMatch) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác');
    }

    if (dto.oldPassword === dto.newPassword) {
      throw new BadRequestException('Mật khẩu mới không được trùng với mật khẩu hiện tại');
    }

    const newPasswordHash = await argon2.hash(dto.newPassword);
    await this.prisma.client.orm.public.User
        .where((u) => u.id.eq(userId))
        .update({ passwordHash: newPasswordHash });

    if (dto.logoutOtherDevices ?? true) {
      const sessions = await this.prisma.client.orm.public.Session
          .where((s) => s.userId.eq(userId))
          .all();

      for (const session of sessions) {
        if (session.id !== currentSessionId) {
          await this.prisma.client.orm.public.Session
              .where({ id: session.id })
              .update({ isRevoked: true });
        }
      }
    }

    return {
      message: 'Đổi mật khẩu thành công',
    };
  }

  async followUser(currentUserId: string, targetIdentifier: string) {
    const currentUser = await this.prisma.client.orm.public.User
      .where((u) => u.id.eq(currentUserId))
      .first();

    if (!currentUser || !currentUser.isActive) {
      throw new ForbiddenException('Tài khoản của bạn đã bị khóa hoặc không tồn tại');
    }

    let targetUser = await this.prisma.client.orm.public.User
      .where((u) => u.id.eq(targetIdentifier))
      .first();

    if (!targetUser) {
      targetUser = await this.prisma.client.orm.public.User
        .where((u) => u.username.eq(targetIdentifier.toLowerCase()))
        .first();
    }

    if (!targetUser || !targetUser.isActive || !targetUser.isEmailVerified) {
      throw new NotFoundException('Người dùng không tồn tại hoặc tài khoản đã bị khóa');
    }

    if (currentUserId === targetUser.id) {
      throw new BadRequestException('Bạn không thể tự theo dõi chính mình');
    }

    const existingFollow = await this.prisma.client.orm.public.Follow
      .where((f) => f.followerId.eq(currentUserId))
      .where((f) => f.followingId.eq(targetUser.id))
      .first();

    if (existingFollow) {
      throw new BadRequestException('Bạn đã theo dõi người dùng này rồi');
    }

    try {
      await this.prisma.client.orm.public.Follow.create({
        followerId: currentUserId,
        followingId: targetUser.id,
      });
    } catch (error: any) {
      if (
        error?.code === '23505' ||
        error?.message?.includes('duplicate key') ||
        error?.message?.includes('violates unique constraint')
      ) {
        throw new BadRequestException('Bạn đã theo dõi người dùng này rồi');
      }
      throw error;
    }

    return {
      message: `Đã theo dõi ${targetUser.displayName}`,
    };
  }

  async unfollowUser(currentUserId: string, targetIdentifier: string) {
    const currentUser = await this.prisma.client.orm.public.User
      .where((u) => u.id.eq(currentUserId))
      .first();

    if (!currentUser || !currentUser.isActive) {
      throw new ForbiddenException('Tài khoản của bạn đã bị khóa hoặc không tồn tại');
    }

    let targetUser = await this.prisma.client.orm.public.User
      .where((u) => u.id.eq(targetIdentifier))
      .first();

    if (!targetUser) {
      targetUser = await this.prisma.client.orm.public.User
        .where((u) => u.username.eq(targetIdentifier.toLowerCase()))
        .first();
    }

    if (!targetUser) {
      throw new NotFoundException('Người dùng không tồn tại');
    }

    if (currentUserId === targetUser.id) {
      throw new BadRequestException('Thao tác không hợp lệ');
    }

    const existingFollow = await this.prisma.client.orm.public.Follow
      .where((f) => f.followerId.eq(currentUserId))
      .where((f) => f.followingId.eq(targetUser.id))
      .first();

    if (!existingFollow) {
      throw new BadRequestException('Bạn chưa theo dõi người dùng này');
    }

    await this.prisma.client.orm.public.Follow
      .where((f) => f.followerId.eq(currentUserId))
      .where((f) => f.followingId.eq(targetUser.id))
      .delete();

    return {
      message: 'Đã hủy theo dõi thành công',
    };
  }

  async getFollowers(username: string, query: FollowPaginationDto) {
    const user = await this.prisma.client.orm.public.User
      .where((u) => u.username.eq(username.toLowerCase()))
      .first();

    if (!user || !user.isActive || !user.isEmailVerified) {
      throw new NotFoundException('Người dùng không tồn tại hoặc tài khoản đã bị khóa');
    }

    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const [totalAgg, follows] = await Promise.all([
      this.prisma.client.orm.public.Follow
        .where((f) => f.followingId.eq(user.id))
        .where((f) => f.follower.some((u) => u.isActive.eq(true)))
        .where((f) => f.follower.some((u) => u.isEmailVerified.eq(true)))
        .aggregate((agg) => ({ total: agg.count() })),
      this.prisma.client.orm.public.Follow
        .where((f) => f.followingId.eq(user.id))
        .where((f) => f.follower.some((u) => u.isActive.eq(true)))
        .where((f) => f.follower.some((u) => u.isEmailVerified.eq(true)))
        .orderBy((f) => f.createdAt.desc())
        .offset(skip)
        .limit(limit)
        .include('follower')
        .all(),
    ]);

    const total = Number(totalAgg.total);

    return {
      items: follows.map((f: any) => ({
        id: f.follower.id,
        username: f.follower.username,
        displayName: f.follower.displayName,
        avatarUrl: f.follower.avatarUrl,
        bio: f.follower.bio,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getFollowing(username: string, query: FollowPaginationDto) {
    const user = await this.prisma.client.orm.public.User
      .where((u) => u.username.eq(username.toLowerCase()))
      .first();

    if (!user || !user.isActive || !user.isEmailVerified) {
      throw new NotFoundException('Người dùng không tồn tại hoặc tài khoản đã bị khóa');
    }

    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const [totalAgg, follows] = await Promise.all([
      this.prisma.client.orm.public.Follow
        .where((f) => f.followerId.eq(user.id))
        .where((f) => f.following.some((u) => u.isActive.eq(true)))
        .where((f) => f.following.some((u) => u.isEmailVerified.eq(true)))
        .aggregate((agg) => ({ total: agg.count() })),
      this.prisma.client.orm.public.Follow
        .where((f) => f.followerId.eq(user.id))
        .where((f) => f.following.some((u) => u.isActive.eq(true)))
        .where((f) => f.following.some((u) => u.isEmailVerified.eq(true)))
        .orderBy((f) => f.createdAt.desc())
        .offset(skip)
        .limit(limit)
        .include('following')
        .all(),
    ]);

    const total = Number(totalAgg.total);

    return {
      items: follows.map((f: any) => ({
        id: f.following.id,
        username: f.following.username,
        displayName: f.following.displayName,
        avatarUrl: f.following.avatarUrl,
        bio: f.following.bio,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
