import React, { createContext, useState, useEffect } from 'react';
import authService from '../services/authService';

// Create the auth context
export const AuthContext = createContext();

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
        console.log('Checking for existing auth session...');
        const userData = await authService.getCurrentUser();
        console.log('User data retrieved successfully:', userData);
        setUser(userData);
        setError(null);
      } catch (err) {
        console.log('No valid session found:', err.message);
        // User is not authenticated, which is normal - don't set this as an error
        setUser(null);
        setError(null);
      } finally {
        setLoading(false);
        console.log('Auth initialization complete');
      }
    };

    initAuth();
  }, []);

  // Login function
  const login = async (credentials) => {
    try {
      setError(null);
      setLoading(true);
      const response = await authService.login(credentials);
      // The server will set the HTTP-only cookie
      // Get the user data from the response or fetch it again
      const user = response.user || await authService.getCurrentUser();
      setUser(user);
      return user;
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
      await authService.logout();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear user state regardless of API call success
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
      const response = await authService.register(userData);
      // The server will set the HTTP-only cookie
      // Get the user data from the response or fetch it again
      const user = response.user || await authService.getCurrentUser();
      setUser(user);
      return user;
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
        balance: newBalance
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
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export default AuthProvider;