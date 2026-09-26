import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MediaService } from '../media/media.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import * as argon2 from 'argon2';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mediaService: MediaService,
  ) {}

  async getPublicProfile(username: string) {
    const user = await this.prisma.client.orm.public.User
      .where((u) => u.username.eq(username.toLowerCase()))
      .first();

    if (!user || !user.isActive) {
      throw new NotFoundException('Người dùng không tồn tại hoặc tài khoản đã bị khóa');
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      bannerUrl: user.bannerUrl,
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

    // Xóa ảnh cũ trên Cloudinary nếu người dùng cập nhật ảnh mới
    if (
      dto.avatarPublicId &&
      currentUser.avatarPublicId &&
      dto.avatarPublicId !== currentUser.avatarPublicId
    ) {
      this.mediaService.deleteFile(currentUser.avatarPublicId);
    }

    if (
      dto.bannerPublicId &&
      currentUser.bannerPublicId &&
      dto.bannerPublicId !== currentUser.bannerPublicId
    ) {
      this.mediaService.deleteFile(currentUser.bannerPublicId);
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

  async changePassword(userId: string, dto: ChangePasswordDto) {
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

    // Thu hồi các phiên đăng nhập khác nếu được yêu cầu (mặc định là true)
    if (dto.logoutOtherDevices ?? true) {
      await this.prisma.client.orm.public.Session
        .where((s) => s.userId.eq(userId))
        .update({ isRevoked: true });
    }

    return {
      message: 'Đổi mật khẩu thành công',
    };
  }
}
