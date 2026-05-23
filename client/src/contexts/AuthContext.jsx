import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authClient } from '../lib/auth-client';
import socketService from '../services/socketService';
import { api } from '../services/api';

// Create the auth context
export const AuthContext = createContext();

/**
 * Coerce a server-supplied balance value to a finite Number.
 *
 * MySQL DECIMAL columns are returned as strings by mysql2 (default behavior),
 * so values arriving from the server (`/users/me`, `balanceUpdate` socket
 * pushes, Better Auth session payloads) can be strings like '1234.50'.
 * Storing them verbatim breaks arithmetic at call sites (`balance * x` →
 * string concatenation, `balance - y` → NaN).
 *
 * Returns `Number(value)` if it parses to a finite number, otherwise
 * `fallback` — never NaN, never a string. The fallback preserves the previous
 * balance when a malformed payload arrives so we don't blow away good state.
 */
function coerceBalance(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Map Better Auth session user to the shape the app expects
 */
function mapUser(sessionUser) {
  if (!sessionUser) return null;
  return {
    id: Number(sessionUser.id),
    username: sessionUser.username || sessionUser.name,
    role: sessionUser.role || 'user',
    balance: coerceBalance(sessionUser.balance, 0),
    isActive: sessionUser.isActive,
  };
}

/**
 * Defensively coerce the `balance` field of a `/users/me` payload before
 * storing it in context. The server returns DECIMAL as a string; downstream
 * components assume a Number.
 */
function normalizeUser(userData) {
  if (!userData) return userData;
  return { ...userData, balance: coerceBalance(userData.balance, 0) };
}

/**
 * AuthProvider Component
 * Manages authentication state and provides login/logout functionality
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Initialize auth state by checking for valid session on component mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        // disableCookieCache: true forces a DB-backed session check so that
        // a stale session_data cookie (e.g. after a signOut that was cancelled
        // mid-flight by an immediate navigation) cannot keep the user logged
        // in. The session_token cookie is still required for auth — but if
        // the underlying DB session was deleted by a signOut, this verifies.
        const { data: session, error: sessionError } = await authClient.getSession({
          query: { disableCookieCache: true },
        });
        if (session?.user && !sessionError) {
          // Fetch full user data including balance from our API
          try {
            const userData = await api.get('/users/me');
            setUser(normalizeUser(userData));
          } catch {
            // Fallback to session data
            setUser(mapUser(session.user));
          }
        } else {
          setUser(null);
        }
        setError(null);
      } catch (err) {
        setUser(null);
        setError(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Login function
  const login = useCallback(async (credentials) => {
    try {
      setError(null);
      setLoading(true);

      const { data, error: signInError } = await authClient.signIn.username({
        username: credentials.username,
        password: credentials.password,
      });

      if (signInError) {
        throw new Error(signInError.message || 'Login failed');
      }

      // Fetch full user data including balance from our API
      let userData;
      try {
        userData = await api.get('/users/me');
      } catch {
        userData = mapUser(data?.user);
      }

      // Reinitialize socket connection (cookies will handle auth)
      socketService.disconnectSocket();
      socketService.initializeSocket();

      const normalized = normalizeUser(userData);
      setUser(normalized);
      return normalized;
    } catch (err) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      setLoading(true);
      await authClient.signOut();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear Better Auth session cookies client-side as a fallback.
      // The session_token cookie is httpOnly so the browser will ignore
      // this for it, but session_data (cookie cache) may not be httpOnly
      // in all configurations.  This also covers any edge case where the
      // server's Set-Cookie clearing headers were lost (e.g., network
      // error or signOut threw above).
      const cookieNames = [
        'better-auth.session_token',
        'better-auth.session_data',
      ];
      cookieNames.forEach((name) => {
        document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0;`;
      });

      // Disconnect socket
      socketService.disconnectSocket();

      setUser(null);
      setError(null);
      setLoading(false);
    }
  }, []);

  // Update user balance (for game wins/losses).
  //
  // Coerces server-supplied values to a finite Number before storing. MySQL
  // DECIMAL returns as a string from mysql2, so `newBalance` may be e.g.
  // '1234.50' on a `balanceUpdate` socket push. If the value can't be coerced
  // (null/undefined/NaN/non-numeric string/empty object), we leave the
  // existing balance untouched rather than corrupt context state.
  const updateBalance = useCallback((newBalance) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = coerceBalance(newBalance, prev.balance);
      if (next === prev.balance) return prev;
      return { ...prev, balance: next };
    });
  }, []);

  // Subscribe to canonical balance updates from the server.
  // The main namespace emits `balanceUpdate` whenever BalanceService mutates
  // the user's balance, making AuthContext the single source of truth.
  useEffect(() => {
    if (!user?.id) return undefined;

    const handler = (payload) => {
      // Server pushes can be either a bare number, a string-number (e.g.
      // '1234.50' from MySQL DECIMAL), or `{ balance }`. Reject null/undefined
      // up front (Number(null) === 0, which would silently zero the balance),
      // then extract the candidate value and require a finite coercion.
      if (payload === null || payload === undefined) return;
      const raw = typeof payload === 'object' ? payload.balance : payload;
      if (raw === null || raw === undefined) return;
      const next = Number(raw);
      if (!Number.isFinite(next)) return;
      if (import.meta.env.DEV) {
        console.debug('[AuthContext] balanceUpdate received:', next);
      }
      updateBalance(next);
    };

    const unsubscribe = socketService.onSocketEvent('balanceUpdate', handler);
    return unsubscribe;
  }, [user?.id, updateBalance]);

  // Refresh user from server (e.g. after profile edit). Errors propagate to caller.
  const refreshUser = useCallback(async () => {
    const userData = await api.get('/users/me');
    const normalized = normalizeUser(userData);
    setUser(normalized);
    return normalized;
  }, []);

  // Context value
  const value = useMemo(() => ({
    user,
    loading,
    error,
    login,
    logout,
    updateBalance,
    refreshUser,
    isAuthenticated: !!user,
  }), [user, loading, error, login, logout, updateBalance, refreshUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
