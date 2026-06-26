import { useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { authApi, setAccessToken, silentRefresh } from '../utils/api';

/**
 * useAuth — primary authentication hook.
 *
 * Handles:
 * - Silent token refresh on app load (via httpOnly cookie)
 * - Login / logout actions
 * - 15-minute inactivity logout timer
 */

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function useAuth() {
  const { accessToken, user, isInitialized, isLoading, setAuth, clearAuth, setInitialized, updateLastActivity } =
    useAuthStore();

  // ── Silent refresh on mount ─────────────────────────────────────────
  useEffect(() => {
    if (isInitialized) return;

    const init = async () => {
      try {
        const refreshed = await silentRefresh();
        if (refreshed) {
          const data = await authApi.me();
          setAuth(
            useAuthStore.getState().accessToken!,
            {
              id: data.user.id,
              role: data.user.role as any,
              nameMarathi: data.user.nameMarathi,
              nameEnglish: data.user.nameEnglish,
              emailVerified: data.user.emailVerified,
            },
          );
        }
      } catch {
        // No valid session — that's fine, user is logged out
      } finally {
        setInitialized();
      }
    };

    init();
  }, [isInitialized, setAuth, setInitialized]);

  // ── Inactivity logout ───────────────────────────────────────────────
  useEffect(() => {
    if (!accessToken) return;

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    const onActivity = () => updateLastActivity();
    events.forEach(e => window.addEventListener(e, onActivity, { passive: true }));

    const interval = setInterval(() => {
      const inactive = Date.now() - useAuthStore.getState().lastActivity;
      if (inactive >= INACTIVITY_TIMEOUT_MS) {
        logout();
      }
    }, 60_000); // Check every minute

    return () => {
      events.forEach(e => window.removeEventListener(e, onActivity));
      clearInterval(interval);
    };
  }, [accessToken, updateLastActivity]);

  // ── Actions ─────────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    setAccessToken(data.accessToken);
    setAuth(data.accessToken, {
      id: data.user.id,
      role: data.user.role as any,
      nameMarathi: data.user.nameMarathi,
      emailVerified: data.user.emailVerified,
    });
    return data.user;
  }, [setAuth]);

  const logout = useCallback(async () => {
    try { await authApi.logout(); } catch { /* ignore */ }
    setAccessToken(null);
    clearAuth();
  }, [clearAuth]);

  return {
    user,
    isAuthenticated: !!accessToken,
    isInitialized,
    isLoading,
    login,
    logout,
  };
}
