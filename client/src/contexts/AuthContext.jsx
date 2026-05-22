import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { authClient } from '../lib/auth-client';
import socketService from '../services/socketService';
import { api } from '../services/api';

// Create the auth context
export const AuthContext = createContext();

/**
 * Map Better Auth session user to the shape the app expects
 */
function mapUser(sessionUser) {
  if (!sessionUser) return null;
  return {
    id: Number(sessionUser.id),
    username: sessionUser.username || sessionUser.name,
    role: sessionUser.role || 'user',
    balance: parseFloat(sessionUser.balance || '0'),
    isActive: sessionUser.isActive,
  };
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
            setUser(userData);
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

      setUser(userData);
      return userData;
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

  // Update user balance (for game wins/losses)
  const updateBalance = useCallback((newBalance) => {
    setUser(prev => {
      if (!prev) return prev;
      return { ...prev, balance: newBalance };
    });
  }, []);

  // Subscribe to canonical balance updates from the server.
  // The main namespace emits `balanceUpdate` whenever BalanceService mutates
  // the user's balance, making AuthContext the single source of truth.
  useEffect(() => {
    if (!user?.id) return undefined;

    const handler = (payload) => {
      const next = typeof payload === 'number' ? payload : payload?.balance;
      if (typeof next !== 'number' || Number.isNaN(next)) return;
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
    setUser(userData);
    return userData;
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
