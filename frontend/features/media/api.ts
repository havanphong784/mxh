import { apiClient } from '@/lib/axios';
import axios from 'axios';

export const mediaApi = {
  // 1. Gọi backend để lấy chữ ký HMAC an toàn
  getUploadSignature: (folder: 'posts' | 'avatars' | 'banners', mediaType: 'IMAGE' | 'VIDEO') =>
    apiClient.get(`/media/upload-signature?folder=${folder}&mediaType=${mediaType}`),

  // 2. Upload file trực tiếp lên Cloudinary bằng FormData
  uploadToCloudinary: async (signatureData: any, file: File) => {
    const { cloudName, apiKey, timestamp, signature, folder, publicId } = signatureData;
    const isVideo = file.type.startsWith('video');
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/${isVideo ? 'video' : 'image'}/upload`;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp.toString());
    formData.append('signature', signature);
    formData.append('folder', folder);
    formData.append('public_id', publicId);

    const res = await axios.post(url, formData);

    return {
      publicId: res.data.public_id,
      version: res.data.version,
      signature,
      type: isVideo ? ('VIDEO' as const) : ('IMAGE' as const),
      order: 0,
      width: res.data.width || null,
      height: res.data.height || null,
      duration: res.data.duration || null,
      url: res.data.secure_url,
    };
  },
};
