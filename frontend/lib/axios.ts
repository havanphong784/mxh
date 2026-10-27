import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {useAuthStore} from '@/stores/authStore';
import type { Author, RefreshResponse } from '@/types/api';
import { shouldAttemptRefresh } from './refresh-policy';
import { singleFlight } from './single-flight';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export const refreshClient = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
});

export const apiClient = axios.create({
    baseURL: BASE_URL,
    withCredentials: true,
});

apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = useAuthStore.getState().accessToken;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Providers và các request bị 401 phải dùng chung đúng một lần xoay refresh cookie.
export const refreshSession = singleFlight(async (): Promise<string> => {
    const response = await refreshClient.post<RefreshResponse>('/auth/refresh');
    const { accessToken } = response.data;
    const meResponse = await refreshClient.get<Author>('/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    useAuthStore.getState().setAuth(meResponse.data, accessToken);
    return accessToken;
});

apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (!shouldAttemptRefresh(error.response?.status, originalRequest?.url, Boolean(originalRequest?._retry))) {
            return Promise.reject(error);
        }

        originalRequest._retry = true;
        const tokenBeforeRefresh = useAuthStore.getState().accessToken;
        let accessToken: string;

        try {
            accessToken = await refreshSession();
        } catch (refreshError) {
            if (useAuthStore.getState().accessToken === tokenBeforeRefresh) {
                useAuthStore.getState().clearAuth();
                if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                    // Interceptors execute outside React; a hard navigation also clears protected caches.
                    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                    window.location.assign('/login');
                }
            }
            return Promise.reject(refreshError);
        }

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
    }
);
