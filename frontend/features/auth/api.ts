import { apiClient } from '@/lib/axios';
import type { ApiMessageResponse, AuthResponse, RegisterResponse } from '@/types/api';

export const authApi = {
  register: (data: { email: string; username: string; displayName: string; password: string }) =>
    apiClient.post<RegisterResponse>('/auth/register', data),

  verifyOtp: (data: { email: string; code: string }) =>
    apiClient.post<AuthResponse>('/auth/verify-otp', data),

  resendOtp: (data: { email: string }) =>
    apiClient.post<ApiMessageResponse>('/auth/resend-otp', data),

  login: (data: { email: string; password: string }) =>
    apiClient.post<AuthResponse>('/auth/login', data),

  logout: () => apiClient.post('/auth/logout'),

  forgotPassword: (email: string) => apiClient.post<ApiMessageResponse>('/auth/forgot-password', { email }),

  resetPassword: (data: { email: string; code: string; newPassword: string }) =>
    apiClient.post<ApiMessageResponse>('/auth/reset-password', data),
};
