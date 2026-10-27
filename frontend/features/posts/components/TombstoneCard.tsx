import React from 'react';

export const TombstoneCard: React.FC<{ message?: string }> = ({ message = 'Bài viết này đã bị xóa bởi tác giả.' }) => {
  return (
    <div className="soft-list-row p-5 text-[13px] italic text-[#8e8ca3]">
      {message}
    </div>
  );
};
