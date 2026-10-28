"use client";

import React, { useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useMediaUpload } from "@/features/media/hooks/useMediaUpload";
import { postsApi } from "../api";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PostComposerUI } from "./PostComposerUI";
import type { PostVisibility, UploadedMedia } from "@/types/api";
import { toPostMediaInput } from "@/features/media/cloudinary";
import { getApiErrorMessage } from "@/lib/api-error";
import { createPostSchema } from "../validation";

export const PostComposer: React.FC<{
  onSuccess?: () => void;
  parentId?: string;
  placeholder?: string;
}> = ({ onSuccess, parentId, placeholder }) => {
  const user = useAuthStore((s) => s.user);
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<PostVisibility>("PUBLIC");
  const [mediaList, setMediaList] = useState<UploadedMedia[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { upload, isUploading } = useMediaUpload();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: postsApi.createPost,
    onSuccess: () => {
      setContent("");
      setVisibility("PUBLIC");
      setMediaList([]);
      setValidationError(null);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      onSuccess?.();
    },
  });

  const handleContentChange = (val: string) => {
    setContent(val);
    if (validationError) setValidationError(null);
  };

  const handleSelectFiles = async (files: FileList) => {
    setValidationError(null);
    if (mediaList.length + files.length > 4) {
      setValidationError("Tối đa 4 ảnh hoặc video cho mỗi bài viết.");
      return;
    }

    for (let i = 0; i < files.length; i++) {
      try {
        const uploaded = await upload(files[i], "posts");
        setMediaList((prev) => [...prev, uploaded]);
      } catch {
        setValidationError("Tải lên media thất bại. Vui lòng thử lại.");
      }
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaList((prev) => prev.filter((_, i) => i !== index));
    if (validationError) setValidationError(null);
  };

  const handleSubmit = () => {
    setValidationError(null);
    const error = createPostSchema.validate({
      content,
      media: mediaList,
    });
    if (error) {
      setValidationError(error);
      return;
    }

    createMutation.mutate({
      content: content.trim() || null,
      visibility: parentId ? undefined : visibility,
      media: mediaList.map(toPostMediaInput),
      parentId: parentId ?? null,
    });
  };

  if (!user) return null;

  return (
    <PostComposerUI
      userAvatarUrl={user.avatarUrl}
      userDisplayName={user.displayName}
      content={content}
      onContentChange={handleContentChange}
      visibility={visibility}
      onVisibilityChange={setVisibility}
      isReply={Boolean(parentId)}
      mediaList={mediaList}
      onRemoveMedia={handleRemoveMedia}
      onSelectFiles={handleSelectFiles}
      onSubmit={handleSubmit}
      isSubmitting={createMutation.isPending}
      isUploading={isUploading}
      errorMessage={
        validationError ||
        (createMutation.isError
          ? getApiErrorMessage(
              createMutation.error,
              "Không thể đăng bài. Vui lòng thử lại.",
            )
          : undefined)
      }
      placeholder={placeholder}
    />
  );
};
