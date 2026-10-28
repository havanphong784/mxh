"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { VerifyOtpForm } from "./VerifyOtpForm";

interface VerifyOtpViewProps {
  initialEmail?: string;
}

export function VerifyOtpView({ initialEmail }: VerifyOtpViewProps) {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || initialEmail || "";

  if (!email) {
    return (
      <div className="text-center text-[13px] text-red-500">
        Không tìm thấy địa chỉ email cần xác thực. Vui lòng quay lại đăng ký.
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-1 text-center text-[16px] font-semibold text-[#1c1b29]">
        Xác thực tài khoản
      </h2>
      <p className="mb-4 text-center text-[13px] text-[#8e8ca3]">
        Nhập mã xác thực đã gửi tới{" "}
        <strong className="text-[#1c1b29]">{email}</strong>
      </p>
      <VerifyOtpForm email={email} />
    </div>
  );
}
