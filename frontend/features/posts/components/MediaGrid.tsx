import React from 'react';
import type { PostMedia } from '@/types/api';

interface MediaGridProps {
  media: PostMedia[];
}

export const MediaGrid: React.FC<MediaGridProps> = ({ media }) => {
  if (!media || media.length === 0) return null;

  return (
    <div
      className={`mt-4 grid gap-2 overflow-hidden rounded-[20px] ${
        media.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
      }`}
    >
      {media.map((item) => {
        if (item.type === 'VIDEO') {
          return (
            <video
              key={item.id || item.publicId}
              src={item.url}
              controls
              className="max-h-[420px] w-full rounded-[20px] bg-[#1c1b29] object-cover shadow-[0_14px_24px_-6px_rgba(28,27,41,.18)]"
            />
          );
        }

        return (
          // User media URLs are dynamic and may not share a configured Next Image host.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.id || item.publicId}
            src={item.url}
            alt="Đính kèm bài viết"
            loading="lazy"
            className="max-h-[420px] w-full rounded-[20px] object-cover shadow-[0_14px_24px_-6px_rgba(28,27,41,.18)] transition-opacity hover:opacity-95"
          />
        );
      })}
    </div>
  );
};
