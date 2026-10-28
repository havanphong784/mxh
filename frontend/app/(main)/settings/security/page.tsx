import type { Metadata } from "next";
import { ChangePasswordForm } from "@/features/users/components/ChangePasswordForm";

export const metadata: Metadata = {
  title: "Bảo mật & Mật khẩu | MXH",
  description: "Quản lý bảo mật tài khoản và đổi mật khẩu.",
};

export default function SecurityPage() {
  return <ChangePasswordForm />;
}
