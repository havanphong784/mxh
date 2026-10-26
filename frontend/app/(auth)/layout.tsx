import React from 'react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fafafa] flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] bg-[#ffffff] border border-[#d5d5d5] rounded-[18px] p-6 sm:p-8">
        <div className="text-center mb-6">
          <h1 className="text-[24px] font-bold text-[#000000] tracking-tight">MXH</h1>
          <p className="text-[13px] text-[#969696] mt-1">Mạng xã hội tối giản & kết nối trực tiếp</p>
        </div>
        {children}
      </div>
    </div>
  );
}
