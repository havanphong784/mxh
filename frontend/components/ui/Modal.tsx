import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#292342]/35 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-[28px] bg-white p-6 shadow-[0_30px_70px_rgba(56,44,104,.22)] sm:p-8">
        <div className="mb-5 flex items-center justify-between border-b border-[#efedf7] pb-4">
          <h2 className="text-[18px] font-extrabold text-[#1c1b29]">{title}</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-[#f4f2fa] text-[20px] font-bold text-[#8e8ca3] hover:text-[#7b78ff]"
            aria-label="Đóng"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
