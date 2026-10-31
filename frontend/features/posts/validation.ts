import { MAX_MEDIA_COUNT, MAX_POST_LENGTH } from "./constants.ts";

export interface CreatePostValidationInput {
  content?: string | null;
  media?: unknown[];
}

export const createPostSchema = {
  validate: (data: CreatePostValidationInput): string | null => {
    const trimmed = data.content?.trim() || "";
    const hasMedia = Array.isArray(data.media) && data.media.length > 0;

    if (!trimmed && !hasMedia) {
      return "Bài viết phải có nội dung chữ hoặc đính kèm ít nhất một hình ảnh/video.";
    }
    if (trimmed.length > MAX_POST_LENGTH) {
      return `Nội dung bài viết không được vượt quá ${MAX_POST_LENGTH} ký tự.`;
    }
    if (data.media && data.media.length > MAX_MEDIA_COUNT) {
      return `Chỉ được phép đính kèm tối đa ${MAX_MEDIA_COUNT} tệp phương tiện.`;
    }
    return null;
  },
};
