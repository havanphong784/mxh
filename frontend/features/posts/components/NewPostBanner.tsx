import React from 'react';

interface NewPostBannerProps {
  onClick: () => void;
}

export const NewPostBanner: React.FC<NewPostBannerProps> = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full py-2.5 bg-[#ffffff] border-b border-[#d5d5d5] text-[#0095f6] text-[13px] font-semibold text-center hover:bg-[#fafafa] transition-colors sticky top-[56px] z-10 cursor-pointer shadow-2xs"
    >
      Có bài viết mới ↑
    </button>
  );
};
