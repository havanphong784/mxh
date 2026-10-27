'use client';

import React, { useRef } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import type { PostVisibility } from '@/types/api';

export interface MediaItemPreview {
  url: string;
  type: 'IMAGE' | 'VIDEO';
}

interface PostComposerUIProps {
  userAvatarUrl?: string | null;
  userDisplayName?: string;
  content: string;
  onContentChange: (val: string) => void;
  visibility: PostVisibility;
  onVisibilityChange: (value: PostVisibility) => void;
  isReply?: boolean;
  mediaList: MediaItemPreview[];
  onRemoveMedia: (index: number) => void;
  onSelectFiles: (files: FileList) => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  isUploading: boolean;
  placeholder?: string;
  errorMessage?: string;
}

export const PostComposerUI: React.FC<PostComposerUIProps> = ({
  userAvatarUrl,
  userDisplayName = 'User',
  content,
  onContentChange,
  visibility,
  onVisibilityChange,
  isReply = false,
  mediaList,
  onRemoveMedia,
  onSelectFiles,
  onSubmit,
  isSubmitting,
  isUploading,
  placeholder = 'Bạn đang nghĩ gì?',
  errorMessage,
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
    <div className="composer-card p-5 sm:p-6">
      <p className="eyebrow mb-4">Chia sẻ một điều thú vị</p>
      <div className="flex gap-3 sm:gap-4">
        {/* Avatar người đăng */}
        <Avatar src={userAvatarUrl} displayName={userDisplayName} size={42} />

        {/* Khung nhập nội dung */}
        <div className="min-w-0 flex-1">
          <textarea
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder={placeholder}
            rows={2}
            maxLength={2200}
            className="min-h-[72px] w-full resize-none bg-transparent text-[14px] leading-relaxed text-[#1c1b29] outline-none placeholder:text-[#8e8ca3]"
            aria-label="Nội dung bài viết"
          />

          {/* Xem trước danh sách ảnh / video đã upload */}
          {mediaList.length > 0 && (
            <div className="grid grid-cols-2 gap-2 my-2">
              {mediaList.map((m, idx) => (
                <div
                  key={idx}
                  className="relative overflow-hidden rounded-[20px] bg-[#f4f2fa]"
                >
                  {m.type === 'VIDEO' ? (
                    <video src={m.url} className="w-full h-32 object-cover" />
                  ) : (
                    // This blob/remote preview URL is transient and cannot be optimized by Next Image.
                    // eslint-disable-next-line @next/next/no-img-element
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

          {errorMessage && <p role="alert" className="my-2 text-[13px] text-red-600">{errorMessage}</p>}

          {/* Thanh công cụ dưới khung nhập */}
          <div className="flex items-center justify-between gap-2 border-t border-[#efedf7] pt-4">
            <div className="flex min-w-0 items-center gap-2">
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
                className="grid h-9 w-9 place-items-center rounded-[13px] bg-[#eef7ff] text-[#64b5f6] transition-colors hover:bg-[#dff0ff] disabled:opacity-50"
                title="Đính kèm ảnh/video"
                aria-label="Đính kèm ảnh hoặc video"
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
              {isReply ? (
                <span className="text-[11px] font-semibold text-[#6d6a82]">Theo quyền xem của bài gốc</span>
              ) : (
                <label className="text-[11px] font-semibold text-[#6d6a82]">
                  <span className="hidden sm:inline">Ai có thể xem </span>
                  <select aria-label="Ai có thể xem bài viết" value={visibility} onChange={(event) => onVisibilityChange(event.target.value as PostVisibility)} className="rounded-full bg-[#f4f2fa] px-2 py-1.5 text-[11px] font-bold text-[#4a4860]">
                    <option value="PUBLIC">Mọi người</option>
                    <option value="FOLLOWERS">Người theo dõi</option>
                    <option value="PRIVATE">Chỉ mình tôi</option>
                  </select>
                </label>
              )}
              {isUploading && (
                <span className="text-[12px] text-[#8e8ca3] animate-pulse">
                  Đang tải lên media...
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <span
                className={`text-[12px] ${
                  isOverLimit ? 'text-red-500 font-bold' : 'text-[#8e8ca3]'
                }`}
              >
                {content.length}/2000
              </span>
              <Button
                type="button"
                onClick={onSubmit}
                isLoading={isSubmitting || isUploading}
                disabled={!canSubmit || isSubmitting || isUploading}
                className="min-h-10 rounded-[20px_6px_20px_6px] px-5"
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
