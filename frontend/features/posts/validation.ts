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
    if (trimmed.length > 2000) {
      return "Nội dung bài viết không được vượt quá 2000 ký tự.";
    }
    if (data.media && data.media.length > 4) {
      return "Tối đa 4 ảnh hoặc video cho mỗi bài viết.";
    }
    return null;
  },
};
