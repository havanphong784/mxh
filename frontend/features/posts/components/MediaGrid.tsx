import React from 'react';
import type { PostMedia } from '@/types/api';

interface MediaGridProps {
  media: PostMedia[];
}

export const MediaGrid: React.FC<MediaGridProps> = ({ media }) => {
  if (!media || media.length === 0) return null;

  return (
    <div
      className={`mt-3 grid gap-2 rounded-[8px] overflow-hidden ${
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
              className="w-full h-auto max-h-[420px] object-cover rounded-[8px] border border-[#d5d5d5] bg-black"
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
            className="w-full h-auto max-h-[420px] object-cover rounded-[8px] border border-[#d5d5d5] hover:opacity-95 transition-opacity"
          />
        );
      })}
    </div>
  );
};
