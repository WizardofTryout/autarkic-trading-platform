import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
    username: string;
    email?: string;
}

interface AuthState {
    token: string | null;
    isAuthenticated: boolean;
    user: User | null;
    login: (token: string, user: User) => void;
    logout: () => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            isAuthenticated: false,
            user: null,
            login: (token: string, user: User) => set({ token, isAuthenticated: true, user }),
            logout: () => set({ token: null, isAuthenticated: false, user: null }),
        }),
        {
            name: 'auth-storage',
        }
    )
);
