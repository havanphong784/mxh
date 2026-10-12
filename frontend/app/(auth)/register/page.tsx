import { RegisterForm } from '@/features/auth/components/RegisterForm';

export const metadata = {
  title: 'Đăng ký tài khoản — MXH',
};

export default function RegisterPage() {
  return (
    <div>
      <h2 className="text-[16px] font-semibold text-[#000000] mb-4 text-center">Tạo tài khoản mới</h2>
      <RegisterForm />
    </div>
  );
}
