import {Injectable, Logger} from '@nestjs/common';
import {v2 as cloudinary} from 'cloudinary';

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
