'use client';

import React, { useRef } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';

interface MediaItemPreview {
  url: string;
  type: 'IMAGE' | 'VIDEO';
}

interface PostComposerUIProps {
  userAvatarUrl?: string | null;
  userDisplayName?: string;
  content: string;
  onContentChange: (val: string) => void;
  mediaList: MediaItemPreview[];
  onRemoveMedia: (index: number) => void;
  onSelectFiles: (files: FileList) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isUploading: boolean;
  placeholder?: string;
}

export const PostComposerUI: React.FC<PostComposerUIProps> = ({
  userAvatarUrl,
  userDisplayName = 'User',
  content,
  onContentChange,
  mediaList,
  onRemoveMedia,
  onSelectFiles,
  onSubmit,
  isSubmitting,
  isUploading,
  placeholder = 'Bạn đang nghĩ gì?',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onSelectFiles(e.target.files);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isOverLimit = content.length > 2000;
  const canSubmit = (content.trim().length > 0 || mediaList.length > 0) && !isOverLimit;

  return (
    <div className="p-4 border-b border-[#d5d5d5] bg-[#ffffff]">
      <div className="flex space-x-3">
        {/* Avatar người đăng */}
        <Avatar src={userAvatarUrl} displayName={userDisplayName} size={36} />

        {/* Khung nhập nội dung */}
        <div className="flex-1">
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder={placeholder}
            rows={3}
            maxLength={2200}
            className="w-full resize-none outline-none text-[15px] placeholder-[#969696] leading-relaxed"
          />

          {/* Xem trước danh sách ảnh / video đã upload */}
          {mediaList.length > 0 && (
            <div className="grid grid-cols-2 gap-2 my-2">
              {mediaList.map((m, idx) => (
                <div
                  key={idx}
                  className="relative rounded-[8px] overflow-hidden border border-[#d5d5d5] bg-[#fafafa]"
                >
                  {m.type === 'VIDEO' ? (
                    <video src={m.url} className="w-full h-32 object-cover" />
                  ) : (
                    <img src={m.url} alt="Xem trước" className="w-full h-32 object-cover" />
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveMedia(idx)}
                    className="absolute top-1.5 right-1.5 bg-black/70 text-white rounded-full w-5 h-5 flex items-center justify-center text-[11px] cursor-pointer hover:bg-black"
                    title="Xóa"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Thanh công cụ dưới khung nhập */}
          <div className="flex items-center justify-between pt-3 border-t border-[#efefef]">
            <div className="flex items-center space-x-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*,video/*"
                multiple
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || isSubmitting}
                className="text-[#424242] hover:text-[#000000] p-1.5 rounded-full hover:bg-[#efefef] transition-colors cursor-pointer disabled:opacity-50"
                title="Đính kèm ảnh/video"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.8"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </button>
              {isUploading && (
                <span className="text-[12px] text-[#969696] animate-pulse">
                  Đang tải lên media...
                </span>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <span
                className={`text-[12px] ${
                  isOverLimit ? 'text-red-500 font-bold' : 'text-[#969696]'
                }`}
              >
                {content.length}/2000
              </span>
              <Button
                type="button"
                onClick={onSubmit}
                isLoading={isSubmitting || isUploading}
                disabled={!canSubmit || isSubmitting || isUploading}
              >
                Đăng
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
