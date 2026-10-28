"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { ResetPasswordForm } from "./ResetPasswordForm";

interface ResetPasswordViewProps {
  initialEmail?: string;
}

export function ResetPasswordView({ initialEmail }: ResetPasswordViewProps) {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || initialEmail || "";

  return (
    <div>
      <h2 className="mb-1 text-center text-[16px] font-semibold text-[#1c1b29]">
        Tạo mật khẩu mới
      </h2>
      <p className="mb-5 text-center text-[13px] text-[#8e8ca3]">
        Nhập mã OTP trong email và mật khẩu mới.
      </p>
      <ResetPasswordForm initialEmail={email} />
    </div>
  );
}
