import {create} from 'zustand';
import type {Author} from '@/types/api';

interface AuthState {
    user: Author | null;
    accessToken: string | null;
    isAuthenticated: boolean;
    setAuth: (user: Author, token: string) => void;
    clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    setAuth: (user, token) =>
        set({
            user,
            accessToken: token,
            isAuthenticated: true,
        }),
    clearAuth: () =>
        set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
        }),
}));