import { LoginForm } from '@/features/auth/components/LoginForm';

export const metadata = {
  title: 'Đăng nhập — MXH',
};

export default function LoginPage() {
  return (
    <div>
      <h2 className="text-[16px] font-semibold text-[#1c1b29] mb-4 text-center">Đăng nhập</h2>
      <LoginForm />
    </div>
  );
}
