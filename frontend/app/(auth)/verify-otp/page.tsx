import type { Metadata } from "next";
import { Suspense } from "react";
import { VerifyOtpView } from "@/features/auth/components/VerifyOtpView";

export const metadata: Metadata = {
  title: "Xác thực tài khoản — MXH",
  description: "Nhập mã xác thực OTP để hoàn tất kích hoạt tài khoản MXH.",
};

interface VerifyOtpPageProps {
  searchParams: Promise<{ email?: string }>;
}

export default async function VerifyOtpPage({
  searchParams,
}: VerifyOtpPageProps) {
  const { email } = await searchParams;
  return (
    <Suspense
      fallback={
        <div className="p-4 text-center text-[13px] text-[#8e8ca3]">
          Đang tải...
        </div>
      }
    >
      <VerifyOtpView initialEmail={email} />
    </Suspense>
  );
}
