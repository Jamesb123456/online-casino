import React, { createContext, useState, useEffect } from 'react';
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
        const { data: session, error: sessionError } = await authClient.getSession();
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
  const login = async (credentials) => {
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
  };

  // Logout function
  const logout = async () => {
    try {
      setLoading(true);
      await authClient.signOut();

      // Disconnect socket
      socketService.disconnectSocket();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setError(null);
      setLoading(false);
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      setError(null);
      setLoading(true);

      const { data, error: signUpError } = await authClient.signUp.email({
        email: `${userData.username}@platinum.local`,
        password: userData.password,
        name: userData.username,
        username: userData.username,
      });

      if (signUpError) {
        throw new Error(signUpError.message || 'Registration failed');
      }

      // Fetch full user data including balance from our API
      let mappedUser;
      try {
        mappedUser = await api.get('/users/me');
      } catch {
        mappedUser = mapUser(data?.user);
      }

      setUser(mappedUser);
      return mappedUser;
    } catch (err) {
      setError(err.message || 'Registration failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Update user balance (for game wins/losses)
  const updateBalance = (newBalance) => {
    if (user) {
      setUser({
        ...user,
        balance: newBalance,
      });
    }
  };

  // Context value
  const value = {
    user,
    loading,
    error,
    login,
    logout,
    register,
    updateBalance,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;
