import {create} from 'zustand';

interface NotificationState {
    unreadCount: number;
    hasNewFeedPosts: boolean;
    setUnreadCount: (count: number) => void;
    increment: () => void;
    reset: () => void;
    showNewFeedPosts: () => void;
    clearNewFeedPosts: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    unreadCount: 0,
    hasNewFeedPosts: false,
    setUnreadCount: (count) => set({ unreadCount: Math.max(0, count) }),
    increment: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
    reset: () => set({ unreadCount: 0, hasNewFeedPosts: false }),
    showNewFeedPosts: () => set({ hasNewFeedPosts: true }),
    clearNewFeedPosts: () => set({ hasNewFeedPosts: false }),
}));
