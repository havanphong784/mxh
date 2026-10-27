import React from 'react';

interface NewPostBannerProps {
  onClick: () => void;
}

export const NewPostBanner: React.FC<NewPostBannerProps> = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="surface-card w-full px-5 py-3 text-center text-[13px] font-bold text-[#7b78ff] transition-colors hover:bg-[#eeedff]"
    >
      Có bài viết mới ↑
    </button>
  );
};
