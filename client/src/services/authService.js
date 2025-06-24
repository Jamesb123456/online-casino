/**
 * Authentication service for user registration, login and logout
 */
import { api } from './api';

const AUTH_ENDPOINTS = {
  REGISTER: '/auth/register',
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  PROFILE: '/users/me',
};

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @returns {Promise} - API response with user data
 */
export const register = async (userData) => {
  try {
    const response = await api.post(AUTH_ENDPOINTS.REGISTER, userData);
    return response;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

/**
 * Log in an existing user
 * @param {Object} credentials - User credentials (email, password)
 * @returns {Promise} - API response with user data
 */
export const login = async (credentials) => {
  try {
    const response = await api.post(AUTH_ENDPOINTS.LOGIN, credentials);
    return response;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

/**
 * Log out the current user
 */
export const logout = async () => {
  try {
    await api.post(AUTH_ENDPOINTS.LOGOUT);
  } catch (error) {
    console.error('Logout error:', error);
    // Don't throw error for logout - we want to clear local state regardless
  }
};

/**
 * Get the currently authenticated user's profile
 * @returns {Promise} - API response with user profile data
 */
export const getCurrentUser = async () => {
  try {
    console.log('Getting current user from cookie...');
    const userData = await api.get(AUTH_ENDPOINTS.PROFILE);
    console.log('User profile data:', userData);
    return userData;
  } catch (error) {
    console.error('Get user profile error:', error);
    throw error;
  }
};

/**
 * Check if a user is currently logged in by trying to get current user
 * @returns {Promise<Boolean>} - True if user is logged in
 */
export const isLoggedIn = async () => {
  try {
    await getCurrentUser();
    return true;
  } catch (error) {
    return false;
  }
};

export default {
  register,
  login,
  logout,
  getCurrentUser,
  isLoggedIn,
};