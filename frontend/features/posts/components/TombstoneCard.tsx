import React from 'react';

export const TombstoneCard: React.FC<{ message?: string }> = ({ message = 'Bài viết này đã bị xóa bởi tác giả.' }) => {
  return (
    <div className="p-4 border-b border-[#d5d5d5] text-[#969696] text-[13px] italic bg-[#fafafa]">
      {message}
    </div>
  );
};
