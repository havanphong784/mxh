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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-[#ffffff] rounded-[18px] border border-[#d5d5d5] max-w-lg w-full p-6 relative shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#d5d5d5]">
          <h2 className="font-semibold text-[15px] text-[#000000]">{title}</h2>
          <button
            onClick={onClose}
            className="text-[#969696] hover:text-[#000000] text-[20px] font-bold cursor-pointer"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};
