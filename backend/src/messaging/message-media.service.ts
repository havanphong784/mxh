import crypto from "node:crypto";
import { BadRequestException, Injectable } from "@nestjs/common";
import { MediaService } from "../media/media.service.js";
import type { MessageMediaInputDto } from "./dto/message-media.dto.js";

export interface VerifiedMessageMedia {
  publicId: string;
  url: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  order: number;
}

@Injectable()
export class MessageMediaService {
  constructor(private readonly media: MediaService) {}

  async verify(userId: string, items: MessageMediaInputDto[]): Promise<VerifiedMessageMedia[]> {
    if (items.length > 5) throw new BadRequestException("Mỗi tin nhắn chỉ được gửi tối đa 5 ảnh");
    const secret = process.env.CLOUDINARY_API_SECRET;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    if (!secret || !cloudName) throw new Error("Chưa cấu hình Cloudinary");
    const seen = new Set<string>();
    return Promise.all(
      items.map(async (item, order) => {
        const expected = crypto
          .createHash("sha1")
          .update(`public_id=${item.publicId}&version=${item.version}${secret}`)
          .digest("hex");
        if (
          !item.publicId.startsWith(`mxh/${userId}/messages/`) ||
          seen.has(item.publicId) ||
          item.signature !== expected
        ) {
          throw new BadRequestException("Ảnh không hợp lệ hoặc không thuộc quyền sở hữu của bạn");
        }
        seen.add(item.publicId);
        const asset = await this.media.getImageMetadata(item.publicId);
        if (
          asset.public_id !== item.publicId ||
          asset.version !== item.version ||
          asset.resource_type !== "image" ||
          asset.type !== "upload" ||
          ![asset.bytes, asset.width, asset.height].every(Number.isSafeInteger) ||
          !["jpg", "jpeg", "png", "webp", "gif"].includes(asset.format) ||
          asset.bytes <= 0 ||
          asset.bytes > 10 * 1024 * 1024 ||
          asset.width <= 0 ||
          asset.height <= 0
        ) {
          throw new BadRequestException("Chỉ chấp nhận ảnh JPEG, PNG, WebP, GIF tối đa 10 MB");
        }
        return {
          publicId: item.publicId,
          url: `https://res.cloudinary.com/${cloudName}/image/upload/v${item.version}/${item.publicId}`,
          width: asset.width,
          height: asset.height,
          format: asset.format,
          bytes: asset.bytes,
          order,
        };
      }),
    );
  }
}
