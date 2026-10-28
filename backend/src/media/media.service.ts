import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from "cloudinary";
import type { EnvironmentVariables } from "../config/env.validation.js";

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    cloudinary.config({
      cloud_name: this.configService.get("CLOUDINARY_CLOUD_NAME", {
        infer: true,
      }),
      api_key: this.configService.get("CLOUDINARY_API_KEY", { infer: true }),
      api_secret: this.configService.get("CLOUDINARY_API_SECRET", {
        infer: true,
      }),
    });
  }

  generateUploadSignature(
    folderName: "avatars" | "banners" | "posts",
    userId: string,
    mediaType: "image" | "video" | "audio" = "image",
  ) {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `mxh/${userId}/${folderName}`;
    const apiSecret = this.configService.get("CLOUDINARY_API_SECRET", {
      infer: true,
    });

    const signature = cloudinary.utils.api_sign_request(
      {
        folder,
        timestamp,
      },
      apiSecret,
    );

    const resourceType = mediaType === "image" ? "image" : "video";

    return {
      signature,
      timestamp,
      apiKey: this.configService.get("CLOUDINARY_API_KEY", { infer: true }),
      cloudName: this.configService.get("CLOUDINARY_CLOUD_NAME", {
        infer: true,
      }),
      folder,
      resourceType,
    };
  }

  async deleteFile(
    publicId?: string | null,
    mediaType: "IMAGE" | "VIDEO" | "AUDIO" = "IMAGE",
  ): Promise<void> {
    if (!publicId) return;

    try {
      const resourceType = mediaType === "IMAGE" ? "image" : "video";
      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
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
      this.logger.log(
        `Đã xóa toàn bộ tài nguyên trên Cloudinary của user: ${userId}`,
      );
    } catch (error) {
      this.logger.error(`Lỗi khi xóa folder của user ${userId}:`, error);
    }
  }
}
