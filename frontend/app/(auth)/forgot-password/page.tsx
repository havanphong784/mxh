import { ForgotPasswordForm } from '@/features/auth/components/ForgotPasswordForm';

export const metadata = { title: 'Quên mật khẩu — MXH' };

export default function ForgotPasswordPage() {
  return <div><h2 className="mb-1 text-center text-[16px] font-semibold">Quên mật khẩu</h2><p className="mb-5 text-center text-[13px] text-[#8e8ca3]">Chúng tôi sẽ gửi mã OTP tới email của bạn.</p><ForgotPasswordForm /></div>;
}
