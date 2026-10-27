import { useMutation } from '@tanstack/react-query';
import { authApi } from '../api';
import { useAuthStore } from '@/stores/authStore';
import { useRouter } from 'next/navigation';

export function useAuth() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const loginMutation = useMutation({
    mutationFn: authApi.login,
    onSuccess: (res) => {
      setAuth(res.data.user, res.data.accessToken);
      router.push('/feed');
    },
  });

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (_, variables) => {
      router.push(`/verify-otp?email=${encodeURIComponent(variables.email)}&type=REGISTER_VERIFY`);
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: authApi.verifyOtp,
    onSuccess: (res) => {
      setAuth(res.data.user, res.data.accessToken);
      router.push('/feed');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authApi.logout,
    onSettled: () => {
      clearAuth();
      router.push('/login');
    },
  });

  return {
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    verifyOtp: verifyOtpMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    isVerifying: verifyOtpMutation.isPending,
    isLoggingOut: logoutMutation.isPending,
  };
}
