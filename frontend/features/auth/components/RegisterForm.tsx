"use client";

import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { getApiErrorMessage } from "@/lib/api-error";
import { validateNewPassword } from "../validation";

export function RegisterForm() {
  const { register, isRegistering } = useAuth();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPasswordError(null);

    const valError = validateNewPassword(password);
    if (valError) {
      setPasswordError(valError);
      return;
    }

    try {
      await register({ email, username, displayName, password });
    } catch (err: unknown) {
      setError(
        getApiErrorMessage(err, "Đăng ký không thành công. Vui lòng thử lại."),
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-[16px] text-[13px] border border-red-200">
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
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          autoComplete="email"
          className="w-full border border-[#efedf7] rounded-[16px] px-3 py-2 text-[14px] bg-[#f4f2fa] outline-none focus:border-[#1c1b29] focus:bg-[#ffffff] transition-colors"
        />
      </div>
      <div>
        <label className="block text-[12px] font-semibold text-[#4a4860] mb-1">
          Tên tài khoản (username)
        </label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="vd: nguyenvana"
          required
          minLength={3}
          maxLength={30}
          pattern="[A-Za-z0-9_]+"
          autoComplete="username"
          className="w-full border border-[#efedf7] rounded-[16px] px-3 py-2 text-[14px] bg-[#f4f2fa] outline-none focus:border-[#1c1b29] focus:bg-[#ffffff] transition-colors"
        />
      </div>
      <div>
        <label className="block text-[12px] font-semibold text-[#4a4860] mb-1">
          Tên hiển thị
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="vd: Nguyễn Văn A"
          required
          minLength={2}
          maxLength={80}
          className="w-full border border-[#efedf7] rounded-[16px] px-3 py-2 text-[14px] bg-[#f4f2fa] outline-none focus:border-[#1c1b29] focus:bg-[#ffffff] transition-colors"
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
            if (passwordError) setPasswordError(null);
          }}
          placeholder="Ít nhất 8 ký tự, có chữ hoa và số"
          required
          minLength={8}
          maxLength={100}
          autoComplete="new-password"
          className={`w-full border rounded-[16px] px-3 py-2 text-[14px] bg-[#f4f2fa] outline-none transition-colors ${
            passwordError
              ? "border-red-400 bg-red-50/40 focus:border-red-500 focus:bg-white"
              : "border-[#efedf7] focus:border-[#1c1b29] focus:bg-[#ffffff]"
          }`}
        />
        {passwordError && (
          <p className="mt-1 text-[12px] text-red-500">{passwordError}</p>
        )}
      </div>
      <Button type="submit" className="w-full mt-2" isLoading={isRegistering}>
        Tiếp tục xác thực OTP
      </Button>
      <div className="text-center mt-4 text-[13px] text-[#8e8ca3]">
        Đã có tài khoản?{" "}
        <Link
          href="/login"
          className="text-[#7b78ff] hover:underline font-semibold"
        >
          Đăng nhập
        </Link>
      </div>
    </form>
  );
}
