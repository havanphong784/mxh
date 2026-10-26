import { apiClient } from '@/lib/axios';
import axios from 'axios';
import type { UploadedMedia, UploadSignature } from '@/types/api';
import { toUploadedMedia, type CloudinaryUploadResponse } from './cloudinary';

export const mediaApi = {
  // 1. Gọi backend để lấy chữ ký HMAC an toàn
  getUploadSignature: (folder: 'posts' | 'avatars' | 'banners', mediaType: 'image' | 'video') =>
    apiClient.get<UploadSignature>('/media/upload-signature', { params: { folder, mediaType } }),

  // 2. Upload file trực tiếp lên Cloudinary bằng FormData
  uploadToCloudinary: async (signatureData: UploadSignature, file: File): Promise<UploadedMedia> => {
    const { cloudName, apiKey, timestamp, signature, folder } = signatureData;
    const isVideo = file.type.startsWith('video');
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/${isVideo ? 'video' : 'image'}/upload`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('folder', folder);

    const res = await axios.post<CloudinaryUploadResponse>(url, formData);

    return toUploadedMedia(res.data, isVideo);
  },
};
