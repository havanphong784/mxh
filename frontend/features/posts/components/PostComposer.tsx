'use client';

import React, { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useMediaUpload } from '@/features/media/hooks/useMediaUpload';
import { postsApi } from '../api';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PostComposerUI } from './PostComposerUI';

export const PostComposer: React.FC<{ onSuccess?: () => void }> = ({ onSuccess }) => {
  const user = useAuthStore((s) => s.user);
  const [content, setContent] = useState('');
  const [mediaList, setMediaList] = useState<any[]>([]);
  const { upload, isUploading } = useMediaUpload();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: postsApi.createPost,
    onSuccess: () => {
      setContent('');
      setMediaList([]);
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      onSuccess?.();
    },
  });

  const handleSelectFiles = async (files: FileList) => {
    if (mediaList.length + files.length > 4) {
      alert('Tối đa 4 ảnh hoặc video cho mỗi bài viết');
      return;
    }

    for (let i = 0; i < files.length; i++) {
      try {
        const uploaded = await upload(files[i], 'posts');
        setMediaList((prev) => [...prev, uploaded]);
      } catch (err) {
        alert('Upload ảnh thất bại. Vui lòng thử lại.');
      }
    }
  };

  const handleRemoveMedia = (index: number) => {
    setMediaList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    createMutation.mutate({
      content: content.trim() || null,
      visibility: 'PUBLIC',
      media: mediaList,
    });
  };

  if (!user) return null;

  return (
    <PostComposerUI
      userAvatarUrl={user.avatarUrl}
      userDisplayName={user.displayName}
      content={content}
      onContentChange={setContent}
      mediaList={mediaList}
      onRemoveMedia={handleRemoveMedia}
      onSelectFiles={handleSelectFiles}
      onSubmit={handleSubmit}
      isSubmitting={createMutation.isPending}
      isUploading={isUploading}
    />
  );
};
