'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { VerifyOtpForm } from '@/features/auth/components/VerifyOtpForm';

function OtpContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  if (!email) {
    return (
      <div className="text-center text-[13px] text-red-500">
        Không tìm thấy địa chỉ email cần xác thực. Vui lòng quay lại đăng ký.
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-[16px] font-semibold text-[#1c1b29] mb-1 text-center">Xác thực tài khoản</h2>
      <p className="text-[13px] text-[#8e8ca3] mb-4 text-center">
        Nhập mã xác thực đã gửi tới <strong className="text-[#1c1b29]">{email}</strong>
      </p>
      <VerifyOtpForm email={email} />
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<div className="p-4 text-center text-[13px] text-[#8e8ca3]">Đang tải...</div>}>
      <OtpContent />
    </Suspense>
  );
}
