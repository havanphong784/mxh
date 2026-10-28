import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordView } from "@/features/auth/components/ResetPasswordView";

export const metadata: Metadata = {
  title: "Tạo mật khẩu mới — MXH",
  description:
    "Nhập mã xác thực OTP và thiết lập mật khẩu mới cho tài khoản MXH.",
};

interface ResetPasswordPageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { email } = await searchParams;
  return (
    <Suspense
      fallback={
        <p className="text-center text-[13px] text-[#8e8ca3]">Đang tải…</p>
      }
    >
      <ResetPasswordView initialEmail={email} />
    </Suspense>
  );
}
