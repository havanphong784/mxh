'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage } from '@/lib/api-error';
import { authApi } from '../api';

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await authApi.forgotPassword(email);
      router.push(`/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Không thể gửi mã đặt lại mật khẩu.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-[16px] border border-red-200 bg-red-50 p-3 text-[13px] text-red-600">{error}</p>}
      <div>
        <label htmlFor="forgot-email" className="mb-1 block text-[12px] font-semibold text-[#4a4860]">Email</label>
        <input id="forgot-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" placeholder="ban@example.com" className="w-full rounded-[16px] border border-[#efedf7] bg-[#f4f2fa] px-3 py-2 text-[14px] outline-none focus:border-[#7b78ff] focus:bg-white" />
      </div>
      <Button type="submit" className="w-full" isLoading={isSubmitting}>Gửi mã đặt lại</Button>
      <Link href="/login" className="block text-center text-[13px] font-semibold text-[#7b78ff] hover:underline">Quay lại đăng nhập</Link>
    </form>
  );
}
