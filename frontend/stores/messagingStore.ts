import { create } from "zustand";

interface MessagingState {
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  reset: () => void;
}

export const useMessagingStore = create<MessagingState>((set) => ({
  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: Math.max(0, count) }),
  reset: () => set({ unreadCount: 0 }),
}));
