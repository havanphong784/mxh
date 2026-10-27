import { useState } from "react";
import { mediaApi } from "../api";

export function useMediaUpload() {
  const [isUploading, setIsUploading] = useState(false);

  const upload = async (
    file: File,
    folder: "posts" | "avatars" | "banners" = "posts",
  ) => {
    setIsUploading(true);
    try {
      const mediaType = file.type.startsWith("video") ? "video" : "image";
      // Bước 1: Lấy chữ ký bảo mật từ Backend
      const sigRes = await mediaApi.getUploadSignature(folder, mediaType);
      // Bước 2: Upload trực tiếp lên Cloudinary
      const uploaded = await mediaApi.uploadToCloudinary(sigRes.data, file);
      return uploaded;
    } finally {
      setIsUploading(false);
    }
  };

  return { upload, isUploading };
}
