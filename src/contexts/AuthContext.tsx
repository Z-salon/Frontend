import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { configureHttp, runRefresh } from '../api/http';
import { authApi } from '../api/auth.api';
import { isNetworkError } from '../api/errors';
import { useToast } from '../components/ui/Toast';
import type { MeResponse } from '../types/api';

export type AuthStatus = 'booting' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  /** Full /auth/me payload, or null when anonymous. */
  user: MeResponse | null;
  /** Current access token, mirrored to localStorage so reloads restore the
   *  session (see TOKEN_KEY). Cleared on logout / failed refresh. */
  accessToken: string | null;
  /** 'booting' until the silent refresh + /me round-trip settles. */
  status: AuthStatus;

  /** Call after register/verify, login, or login/complete. */
  login: (accessToken: string) => Promise<void>;
  /** Revokes the current session (§2.13). */
  logout: () => Promise<void>;
  /** Revokes every session of the user (§2.13). */
  logoutAll: () => Promise<void>;
  /** Manually force a refresh (§2.12). Returns the new token or null. */
  refresh: () => Promise<string | null>;
  /** Re-fetch /auth/me (e.g. after accepting an invitation). */
  reloadMe: () => Promise<MeResponse | null>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * The access token is mirrored to localStorage so a reload can restore the
 * session immediately (via /auth/me) instead of depending only on the
 * httpOnly refreshToken cookie — which is dropped over plain HTTP when the
 * server marks it `Secure` (production flag, §1). The cookie refresh is kept
 * as a fallback for when the token has expired.
 */
const TOKEN_KEY = 'zsalon.accessToken';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [status, setStatus] = useState<AuthStatus>('booting');
  const toast = useToast();

  /**
   * Kept in a ref so `getAccessToken()` and `refreshAccessToken()` passed to
   * configureHttp always see the latest value — without re-configuring on
   * every render.
   */
  const tokenRef = useRef<string | null>(null);

  const setToken = useCallback((token: string | null) => {
    tokenRef.current = token;
    setAccessToken(token);
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }, []);

  const clearSession = useCallback(() => {
    setToken(null);
    setUser(null);
    setStatus('anonymous');
  }, [setToken]);

  /** Fetch /auth/me and hydrate the user. */
  const loadMe = useCallback(async (): Promise<MeResponse | null> => {
    try {
      const me = await authApi.me();
      setUser(me);
      setStatus('authenticated');
      return me;
    } catch (err) {
      if (isNetworkError(err)) toast.error('Network Error');
      clearSession();
      return null;
    }
  }, [clearSession]);

  /**
   * §2.12 — POST /auth/refresh. Cookie-only, no Bearer header.
   * Never throws; returns null on failure so the caller can decide.
   */
  const refresh = useCallback(async (): Promise<string | null> => {
    try {
      const res = await authApi.refresh();
      if (res?.accessToken) {
        setToken(res.accessToken);
        return res.accessToken;
      }
      return null;
    } catch {
      return null;
    }
  }, [setToken]);

  /** Called by login pages after a successful auth call. */
  const login = useCallback(
    async (token: string) => {
      setToken(token);
      await loadMe();
    },
    [setToken, loadMe],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch (err) {
      if (isNetworkError(err)) toast.error('Network Error');
      // We clear local state either way.
    }
    clearSession();
  }, [clearSession]);

  const logoutAll = useCallback(async () => {
    try {
      await authApi.logoutAll();
    } catch (err) {
      if (isNetworkError(err)) toast.error('Network Error');
    }
    clearSession();
  }, [clearSession]);

  const reloadMe = useCallback(() => loadMe(), [loadMe]);

  /**
   * Wire the HTTP client exactly once. `getAccessToken` reads the ref, so it
   * always has the current token. `refreshAccessToken` delegates to our
   * refresh() — the single-flight logic in http.ts ensures concurrent 401s
   * trigger only one /auth/refresh call.
   */
  useEffect(() => {
    configureHttp({
      getAccessToken: () => tokenRef.current,
      refreshAccessToken: refresh,
      onUnauthorized: clearSession,
    });
  }, [refresh, clearSession]);

  /**
   * Boot restore. Two phases:
   *
   * 1. If a token survives in localStorage, use it for /auth/me right away —
   *    no cookie round-trip needed for a normal reload. If the token has
   *    expired, http.ts quietly retries once through the single-flight
   *    cookie refresh before declaring the session dead.
   * 2. Otherwise try the httpOnly refreshToken cookie (§2.12). Only if both
   *    fail do we land on the login screen.
   *
   * StrictMode dev runs this effect twice; both runs are allowed to proceed,
   * but the /auth/refresh call itself is single-flight (`runRefresh`) so two
   * parallel GETs/rotations can never race the same cookie.
   */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Phase 1 — persisted access token.
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored) {
        setToken(stored);
        try {
          const me = await authApi.me();
          if (cancelled) return;
          setUser(me);
          setStatus('authenticated');
          return;
        } catch (err) {
          // Stored token missing/expired/revoked. http.ts already attempted a
          // refresh on the 401; if that worked we'd be back in the try block,
          // so this means the refresh failed too. Fall through to Phase 2,
          // mostly so the storage is cleaned up.
          if (isNetworkError(err)) toast.error('Network Error');
          if (cancelled) return;
        }
      }

      // Phase 2 — cookie-based silent refresh (single-flight).
      const token = await runRefresh();
      if (cancelled) return;

      if (!token) {
        clearSession();
        return;
      }

      await loadMe();
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      status,
      login,
      logout,
      logoutAll,
      refresh,
      reloadMe,
    }),
    [user, accessToken, status, login, logout, logoutAll, refresh, reloadMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}