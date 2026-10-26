'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ResetPasswordForm } from '@/features/auth/components/ResetPasswordForm';

function ResetContent() {
  const email = useSearchParams().get('email') ?? '';
  return <div><h2 className="mb-1 text-center text-[16px] font-semibold">Tạo mật khẩu mới</h2><p className="mb-5 text-center text-[13px] text-[#969696]">Nhập mã OTP trong email và mật khẩu mới.</p><ResetPasswordForm initialEmail={email} /></div>;
}

export default function ResetPasswordPage() {
  return <Suspense fallback={<p className="text-center text-[13px] text-[#969696]">Đang tải…</p>}><ResetContent /></Suspense>;
}
