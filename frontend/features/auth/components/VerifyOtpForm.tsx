'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { authApi } from '../api';
import { Button } from '@/components/ui/Button';
import { getApiErrorMessage } from '@/lib/api-error';
import { normalizeOtp } from '../validation';

interface VerifyOtpFormProps {
  email: string;
}

export function VerifyOtpForm({ email }: VerifyOtpFormProps) {
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
      await verifyOtp({ email, code });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Mã xác thực không hợp lệ hoặc đã hết hạn.'));
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || isResending) return;
    setIsResending(true);
    setError(null);
    setResendSuccess(false);
    try {
      await authApi.resendOtp({ email });
      setResendSuccess(true);
      setResendCooldown(60);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Không thể gửi lại mã OTP lúc này.'));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-[16px] text-[13px] border border-red-200">
          {error}
        </div>
      )}
      {resendSuccess && (
        <div className="p-3 bg-green-50 text-green-700 rounded-[16px] text-[13px] border border-green-200">
          Đã gửi mã xác thực mới đến email của bạn!
        </div>
      )}
      <div>
        <label className="block text-[12px] font-semibold text-[#4a4860] mb-1">
          Mã xác thực OTP (6 chữ số)
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(normalizeOtp(e.target.value))}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="123456"
          maxLength={6}
          required
          className="w-full tracking-widest text-center font-mono text-[20px] font-bold border border-[#efedf7] rounded-[16px] px-3 py-2 bg-[#f4f2fa] outline-none focus:border-[#1c1b29] focus:bg-[#ffffff] transition-colors"
        />
      </div>
      <Button type="submit" className="w-full mt-2" isLoading={isVerifying} disabled={code.trim().length < 6}>
        Xác nhận
      </Button>

      <div className="text-center mt-4 text-[13px] text-[#8e8ca3]">
        {resendCooldown > 0 ? (
          <span>Gửi lại mã sau {resendCooldown}s</span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending}
            className="text-[#7b78ff] hover:underline font-semibold cursor-pointer"
          >
            {isResending ? 'Đang gửi...' : 'Gửi lại mã xác thực'}
          </button>
        )}
      </div>
    </form>
  );
}
