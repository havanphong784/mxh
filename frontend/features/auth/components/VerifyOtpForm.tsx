'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api';
import { Button } from '@/components/ui/Button';

interface VerifyOtpFormProps {
  email: string;
  type?: 'REGISTER_VERIFY' | 'FORGOT_PASSWORD';
}

export function VerifyOtpForm({ email, type = 'REGISTER_VERIFY' }: VerifyOtpFormProps) {
  const { verifyOtp, isVerifying } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await verifyOtp({ email, code: code.trim(), type });
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Mã xác thực không hợp lệ hoặc đã hết hạn.');
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setError(null);
    setResendSuccess(false);
    try {
      await authApi.resendOtp({ email, type });
      setResendSuccess(true);
      setResendCooldown(60);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Không thể gửi lại mã OTP lúc này.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-[8px] text-[13px] border border-red-200">
          {error}
        </div>
      )}
      {resendSuccess && (
        <div className="p-3 bg-green-50 text-green-700 rounded-[8px] text-[13px] border border-green-200">
          Đã gửi mã xác thực mới đến email của bạn!
        </div>
      )}
      <div>
        <label className="block text-[12px] font-semibold text-[#424242] mb-1">
          Mã xác thực OTP (6 chữ số)
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="123456"
          maxLength={6}
          required
          className="w-full tracking-widest text-center font-mono text-[20px] font-bold border border-[#d5d5d5] rounded-[8px] px-3 py-2 bg-[#fafafa] outline-none focus:border-[#000000] focus:bg-[#ffffff] transition-colors"
        />
      </div>
      <Button type="submit" className="w-full mt-2" isLoading={isVerifying} disabled={code.trim().length < 6}>
        Xác nhận
      </Button>

      <div className="text-center mt-4 text-[13px] text-[#969696]">
        {resendCooldown > 0 ? (
          <span>Gửi lại mã sau {resendCooldown}s</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="text-[#385898] hover:underline font-semibold cursor-pointer"
          >
            {isResending ? 'Đang gửi...' : 'Gửi lại mã xác thực'}
          </button>
        )}
      </div>
    </form>
  );
}
