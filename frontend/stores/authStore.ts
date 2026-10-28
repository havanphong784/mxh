import { create } from "zustand";
import type { Author } from "../types/api.ts";
import { queryClient } from "../lib/query-client.ts";
import { useNotificationStore } from "./notificationStore.ts";

function clearAccountData() {
  queryClient.clear();
  useNotificationStore.getState().reset();
}

interface AuthState {
  user: Author | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  sessionVersion: number;
  setAuth: (user: Author, token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  sessionVersion: 0,
  setAuth: (user, token) =>
    set((state) => {
      const changedAccount = state.user?.id !== user.id;
      if (changedAccount) clearAccountData();
      return {
        user,
        accessToken: token,
        isAuthenticated: true,
        sessionVersion: state.sessionVersion + Number(changedAccount),
      };
    }),
  clearAuth: () => {
    clearAccountData();
    set((state) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      sessionVersion: state.sessionVersion + 1,
    }));
  },
}));
