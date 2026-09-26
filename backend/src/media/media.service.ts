import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

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

  generateUploadSignature(folderName: 'avatars' | 'banners' | 'posts') {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `mxh/${folderName}`;
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

    return {
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      folder,
    };
  }

  async deleteFile(publicId?: string | null): Promise<void> {
    if (!publicId) return;

    try {
      await cloudinary.uploader.destroy(publicId);
      this.logger.log(`Đã xóa ảnh cũ trên Cloudinary: ${publicId}`);
    } catch (error) {
      this.logger.error(`Lỗi khi xóa file ${publicId}:`, error);
    }
  }
}
