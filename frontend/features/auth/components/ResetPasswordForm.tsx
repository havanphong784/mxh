'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage } from '@/lib/api-error';
import { authApi } from '../api';
import { normalizeOtp, validateNewPassword } from '../validation';

export function ResetPasswordForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validateNewPassword(password);
    if (validationError) return setError(validationError);
    if (password !== confirmPassword) return setError('Mật khẩu xác nhận chưa khớp.');
    setIsSubmitting(true);
    setError(null);
    try {
      await authApi.resetPassword({ email, code, newPassword: password });
      router.push('/login?reset=success');
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Không thể đặt lại mật khẩu.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = 'w-full rounded-[16px] border border-[#efedf7] bg-[#f4f2fa] px-3 py-2 text-[14px] outline-none focus:border-[#7b78ff] focus:bg-white';
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-[16px] border border-red-200 bg-red-50 p-3 text-[13px] text-red-600">{error}</p>}
      <label className="block text-[12px] font-semibold text-[#4a4860]">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" className={`${inputClass} mt-1`} /></label>
      <label className="block text-[12px] font-semibold text-[#4a4860]">Mã OTP<input value={code} onChange={(event) => setCode(normalizeOtp(event.target.value))} required minLength={6} inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className={`${inputClass} mt-1 text-center font-mono text-[18px] tracking-[0.3em]`} /></label>
      <label className="block text-[12px] font-semibold text-[#4a4860]">Mật khẩu mới<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} autoComplete="new-password" className={`${inputClass} mt-1`} /></label>
      <label className="block text-[12px] font-semibold text-[#4a4860]">Nhập lại mật khẩu<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={8} autoComplete="new-password" className={`${inputClass} mt-1`} /></label>
      <Button type="submit" className="w-full" isLoading={isSubmitting}>Đặt lại mật khẩu</Button>
    </form>
  );
}
