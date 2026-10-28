import type { PostMediaInput, UploadedMedia } from "../../types/api.ts";

export interface CloudinaryUploadResponse {
  public_id: string;
  version: number;
  signature: string;
  width?: number;
  height?: number;
  duration?: number;
  secure_url: string;
}

export function toUploadedMedia(
  data: CloudinaryUploadResponse,
  isVideo: boolean,
): UploadedMedia {
  return {
    publicId: data.public_id,
    version: data.version,
    signature: data.signature,
    type: isVideo ? "VIDEO" : "IMAGE",
    order: 0,
    width: data.width ?? null,
    height: data.height ?? null,
    duration: data.duration ?? null,
    url: data.secure_url,
  };
}

export function toPostMediaInput(
  media: UploadedMedia,
  order: number,
): PostMediaInput {
  return {
    publicId: media.publicId,
    version: String(media.version),
    signature: media.signature,
    type: media.type,
    order,
    ...(media.width == null ? {} : { width: media.width }),
    ...(media.height == null ? {} : { height: media.height }),
    ...(media.duration == null ? {} : { duration: media.duration }),
  };
}

export function getOptimizedMediaUrl(
  url: string | null | undefined,
  width = 800,
): string {
  if (!url) return "";
  if (!url.includes("cloudinary.com") || !url.includes("/upload/")) return url;
  if (url.includes("/f_auto") || url.includes("/q_auto")) return url;
  return url.replace(
    "/upload/",
    `/upload/f_auto,q_auto:good,w_${width},c_limit/`,
  );
}
