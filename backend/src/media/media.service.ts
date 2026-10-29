import { BadRequestException, HttpStatus, Injectable, Logger } from "@nestjs/common";
import { v2 as cloudinary } from "cloudinary";
import crypto from "node:crypto";
import { DomainException, ERROR_CODES } from "../common/exceptions/domain.exception.js";

export interface VerifiedMediaItem {
  publicId: string;
  url: string;
  type: "IMAGE" | "VIDEO" | "AUDIO";
  width: number | null;
  height: number | null;
  duration: number | null;
  order: number;
}

export interface VerifyMediaItemInput {
  publicId: string;
  version: string | number;
  signature: string;
  type: "IMAGE" | "VIDEO" | "AUDIO";
  width?: number;
  height?: number;
  duration?: number;
  order: number;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }

  verifyMediaItems(
    userId: string,
    mediaItems: VerifyMediaItemInput[],
  ): VerifiedMediaItem[] {
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (!apiSecret || !cloudName) {
      throw new Error(
        "Chưa cấu hình CLOUDINARY_API_SECRET hoặc CLOUDINARY_CLOUD_NAME",
      );
    }
    const expectedPrefix = `mxh/${userId}/posts/`;
    const seenPublicIds = new Set<string>();

    return mediaItems.map((item) => {
      if (seenPublicIds.has(item.publicId)) {
        throw new BadRequestException(`Media ${item.publicId} bị trùng lặp`);
      }
      seenPublicIds.add(item.publicId);

      if (!item.publicId.startsWith(expectedPrefix)) {
        throw new BadRequestException(
          `Media ${item.publicId} không hợp lệ hoặc không thuộc quyền sở hữu của bạn`,
        );
      }
      const signaturePayload = `public_id=${item.publicId}&version=${item.version}${apiSecret}`;
      const expectedSignature = crypto
        .createHash("sha1")
        .update(signaturePayload)
        .digest("hex");
      if (item.signature !== expectedSignature) {
        throw new DomainException(
          ERROR_CODES.MEDIA_INVALID_SIGNATURE,
          `Chữ ký media ${item.publicId} không hợp lệ`,
          HttpStatus.BAD_REQUEST,
        );
      }
      const resourceType = item.type === "IMAGE" ? "image" : "video";
      const secureUrl = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/v${item.version}/${item.publicId}`;
      return {
        publicId: item.publicId,
        url: secureUrl,
        type: item.type,
        width: item.width ?? null,
        height: item.height ?? null,
        duration: item.duration ?? null,
        order: item.order,
      };
    });
  }

  generateUploadSignature(folderName: 'avatars' | 'banners' | 'posts', userId: string, mediaType: 'image' | 'video' | 'audio' = 'image') {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `mxh/${userId}/${folderName}`;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!apiSecret) {
      throw new Error('Chưa cấu hình CLOUDINARY_API_SECRET');
    }

    const signature = cloudinary.utils.api_sign_request(
      {
        folder,
        timestamp,
      },
      apiSecret,
    );

    const resourceType = mediaType === 'image' ? 'image' : 'video';

    return {
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      folder,
      resourceType,
    };
  }

  async deleteFile(
    publicId?: string | null,
    mediaType: 'IMAGE' | 'VIDEO' | 'AUDIO' = 'IMAGE',
  ): Promise<void> {
    if (!publicId) return;

    try {
      const resourceType = mediaType === 'IMAGE' ? 'image' : 'video';
      await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
      this.logger.log(`Đã xóa media cũ trên Cloudinary: ${publicId}`);
    } catch (error) {
      this.logger.error(`Lỗi khi xóa file ${publicId}:`, error);
    }
  }

  async deleteUserFolder(userId: string): Promise<void> {
    try {
      const prefix = `mxh/${userId}/`;
      await cloudinary.api.delete_resources_by_prefix(prefix);
      await cloudinary.api.delete_folder(`mxh/${userId}`);
      this.logger.log(`Đã xóa toàn bộ tài nguyên trên Cloudinary của user: ${userId}`);
    } catch (error) {
      this.logger.error(`Lỗi khi xóa folder của user ${userId}:`, error);
    }
  }
}
