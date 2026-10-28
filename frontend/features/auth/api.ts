import type { AxiosResponse } from "axios";
import { apiClient } from "@/lib/axios";
import type {
  ApiMessageResponse,
  AuthResponse,
  RegisterResponse,
} from "@/types/api";

export const authApi = {
  register: (data: {
    email: string;
    username: string;
    displayName: string;
    password: string;
  }): Promise<AxiosResponse<RegisterResponse>> =>
    apiClient.post<RegisterResponse>("/auth/register", data),

  verifyOtp: (data: {
    email: string;
    code: string;
  }): Promise<AxiosResponse<AuthResponse>> =>
    apiClient.post<AuthResponse>("/auth/verify-otp", data),

  resendOtp: (data: {
    email: string;
  }): Promise<AxiosResponse<ApiMessageResponse>> =>
    apiClient.post<ApiMessageResponse>("/auth/resend-otp", data),

  login: (data: {
    email: string;
    password: string;
  }): Promise<AxiosResponse<AuthResponse>> =>
    apiClient.post<AuthResponse>("/auth/login", data),

  logout: (): Promise<AxiosResponse<void>> => apiClient.post("/auth/logout"),

  forgotPassword: (email: string): Promise<AxiosResponse<ApiMessageResponse>> =>
    apiClient.post<ApiMessageResponse>("/auth/forgot-password", { email }),

  resetPassword: (data: {
    email: string;
    code: string;
    newPassword: string;
  }): Promise<AxiosResponse<ApiMessageResponse>> =>
    apiClient.post<ApiMessageResponse>("/auth/reset-password", data),
};
