import { create } from 'zustand';

/**
 * Authentication store — access token in memory ONLY (Zustand).
 *
 * SECURITY: Access token is NEVER stored in localStorage or sessionStorage.
 * Refresh token lives in an httpOnly, Secure, SameSite=Strict cookie
 * set by the server — the frontend never reads or writes it directly.
 *
 * On app load: attempt silent refresh via the httpOnly cookie.
 * On 15 minutes of inactivity: automatic logout.
 */

interface User {
  id: string;
  role: 'artisan' | 'apprentice' | 'researcher' | 'admin';
  nameMarathi: string;
  nameEnglish?: string;
  emailVerified: boolean;
}

interface AuthState {
  /** Access token — in memory only, never persisted */
  accessToken: string | null;
  /** Current user data */
  user: User | null;
  /** Whether initial auth check has completed */
  isInitialized: boolean;
  /** Whether auth is loading (silent refresh, login, etc.) */
  isLoading: boolean;
  /** Last user interaction timestamp for inactivity logout */
  lastActivity: number;

  // Actions
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
  setInitialized: () => void;
  updateLastActivity: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  isInitialized: false,
  isLoading: true,
  lastActivity: Date.now(),

  setAuth: (accessToken, user) => set({
    accessToken,
    user,
    isLoading: false,
    lastActivity: Date.now(),
  }),

  clearAuth: () => set({
    accessToken: null,
    user: null,
    isLoading: false,
  }),

  setInitialized: () => set({ isInitialized: true, isLoading: false }),

  updateLastActivity: () => set({ lastActivity: Date.now() }),
}));
