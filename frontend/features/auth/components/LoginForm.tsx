'use client';

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';
import { getApiErrorMessage } from '@/lib/api-error';

export function LoginForm() {
  const { login, isLoggingIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login({ email, password });
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Đăng nhập không thành công. Vui lòng kiểm tra lại.'));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-[8px] text-[13px] border border-red-200">
          {error}
        </div>
      )}
      <div>
        <label className="block text-[12px] font-semibold text-[#424242] mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="ban@example.com"
          autoComplete="email"
          required
          className="w-full border border-[#d5d5d5] rounded-[8px] px-3 py-2 text-[14px] bg-[#fafafa] outline-none focus:border-[#000000] focus:bg-[#ffffff] transition-colors"
        />
      </div>
      <div>
        <label className="block text-[12px] font-semibold text-[#424242] mb-1">
          Mật khẩu
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          autoComplete="current-password"
          className="w-full border border-[#d5d5d5] rounded-[8px] px-3 py-2 text-[14px] bg-[#fafafa] outline-none focus:border-[#000000] focus:bg-[#ffffff] transition-colors"
        />
      </div>
      <Button type="submit" className="w-full mt-2" isLoading={isLoggingIn}>
        Đăng nhập
      </Button>
      <div className="text-right">
        <Link href="/forgot-password" className="text-[12px] font-semibold text-[#385898] hover:underline">
          Quên mật khẩu?
        </Link>
      </div>
      <div className="text-center mt-4 text-[13px] text-[#969696]">
        Chưa có tài khoản?{' '}
        <Link href="/register" className="text-[#385898] hover:underline font-semibold">
          Đăng ký ngay
        </Link>
      </div>
    </form>
  );
}
