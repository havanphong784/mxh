"use client";

import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { getApiErrorMessage } from "@/lib/api-error";

export function LoginForm() {
  const { login, isLoggingIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await login({ email, password });
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(
          err,
          "Đăng nhập không thành công. Vui lòng kiểm tra lại.",
        ),
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-[16px] border border-red-200 bg-red-50 p-3 text-[13px] text-red-600">
          {error}
        </div>
      )}
      <div>
        <label className="block text-[12px] font-semibold text-[#4a4860] mb-1">
          Email
        </label>
        <input
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          placeholder="ban@example.com"
          autoComplete="email"
          required
          className={`w-full border rounded-[16px] px-3 py-2 text-[14px] outline-none transition-colors ${
            error
              ? "border-red-300 bg-red-50/30 focus:border-red-500 focus:bg-white"
              : "border-[#efedf7] bg-[#f4f2fa] focus:border-[#1c1b29] focus:bg-[#ffffff]"
          }`}
        />
      </div>
      <div>
        <label className="block text-[12px] font-semibold text-[#4a4860] mb-1">
          Mật khẩu
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError(null);
          }}
          placeholder="••••••••"
          required
          autoComplete="current-password"
          className={`w-full border rounded-[16px] px-3 py-2 text-[14px] outline-none transition-colors ${
            error
              ? "border-red-300 bg-red-50/30 focus:border-red-500 focus:bg-white"
              : "border-[#efedf7] bg-[#f4f2fa] focus:border-[#1c1b29] focus:bg-[#ffffff]"
          }`}
        />
      </div>
      <Button type="submit" className="w-full mt-2" isLoading={isLoggingIn}>
        Đăng nhập
      </Button>
      <div className="text-right">
        <Link
          href="/forgot-password"
          className="text-[12px] font-semibold text-[#7b78ff] hover:underline"
        >
          Quên mật khẩu?
        </Link>
      </div>
      <div className="text-center mt-4 text-[13px] text-[#8e8ca3]">
        Chưa có tài khoản?{" "}
        <Link
          href="/register"
          className="text-[#7b78ff] hover:underline font-semibold"
        >
          Đăng ký ngay
        </Link>
      </div>
    </form>
  );
}
