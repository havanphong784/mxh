import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import {useAuthStore} from '@/stores/authStore';
import type { Author, RefreshResponse } from '@/types/api';
import { shouldAttemptRefresh } from './refresh-policy';

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

let isRefreshing = false;
let failedQueue: Array<{
    resolve: (value?: unknown) => void;
    reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null) => {
    failedQueue.forEach((promise) => {
        if (error) {
            promise.reject(error);
        } else {
            promise.resolve();
        }
    });
    failedQueue = [];
};

apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        if (!shouldAttemptRefresh(error.response?.status, originalRequest?.url, Boolean(originalRequest?._retry))) {
            return Promise.reject(error);
        }

        if (isRefreshing) {
            return new Promise((resolve, reject) => {
                failedQueue.push({ resolve, reject });
            })
                .then(() => apiClient(originalRequest))
                .catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
            const response = await refreshClient.post<RefreshResponse>('/auth/refresh');
            const { accessToken } = response.data;
            const meResponse = await refreshClient.get<Author>('/auth/me', {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            useAuthStore.getState().setAuth(meResponse.data, accessToken);
            processQueue(null);

            originalRequest.headers.Authorization = `Bearer ${accessToken}`;
            return apiClient(originalRequest);
        } catch (refreshError) {
            processQueue(refreshError as Error);
            useAuthStore.getState().clearAuth();
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
                // Interceptors execute outside React; a hard navigation also clears protected caches.
                // eslint-disable-next-line @next/next/no-location-assign-relative-destination
                window.location.assign('/login');
            }
            return Promise.reject(refreshError);
        } finally {
            isRefreshing = false;
        }
    }
);
