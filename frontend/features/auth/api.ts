import { apiClient } from '@/lib/axios';

export const authApi = {
  register: (data: { email: string; username: string; displayName: string; password: string }) =>
    apiClient.post('/auth/register', data),

  verifyOtp: (data: { email: string; code: string; type: 'REGISTER_VERIFY' | 'FORGOT_PASSWORD' }) =>
    apiClient.post('/auth/verify-otp', data),

  resendOtp: (data: { email: string; type: 'REGISTER_VERIFY' | 'FORGOT_PASSWORD' }) =>
    apiClient.post('/auth/resend-otp', data),

  login: (data: { identifier: string; password: string }) =>
    apiClient.post('/auth/login', data),

  logout: () => apiClient.post('/auth/logout'),

  forgotPassword: (email: string) => apiClient.post('/auth/forgot-password', { email }),

  resetPassword: (data: { email: string; code: string; newPassword: string }) =>
    apiClient.post('/auth/reset-password', data),
};
