/**
 * Authentication service for user registration, login and logout
 */
import { api } from './api';

const AUTH_ENDPOINTS = {
  REGISTER: '/auth/register',
  LOGIN: '/auth/login',
  PROFILE: '/users/profile',
};

/**
 * Register a new user
 * @param {Object} userData - User registration data
 * @returns {Promise} - API response with user data and token
 */
export const register = async (userData) => {
  try {
    const response = await api.post(AUTH_ENDPOINTS.REGISTER, userData);
    
    // Store token in localStorage if available
    if (response.token) {
      localStorage.setItem('token', response.token);
    }
    
    return response;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

/**
 * Log in an existing user
 * @param {Object} credentials - User credentials (email, password)
 * @returns {Promise} - API response with user data and token
 */
export const login = async (credentials) => {
  try {
    const response = await api.post(AUTH_ENDPOINTS.LOGIN, credentials);
    
    // Store token in localStorage
    if (response.token) {
      localStorage.setItem('token', response.token);
    }
    
    return response;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

/**
 * Log out the current user
 */
export const logout = () => {
  // Remove token from localStorage
  localStorage.removeItem('token');
};

/**
 * Get the currently authenticated user's profile
 * @returns {Promise} - API response with user profile data
 */
export const getCurrentUser = async () => {
  try {
    return await api.get(AUTH_ENDPOINTS.PROFILE);
  } catch (error) {
    console.error('Get user profile error:', error);
    throw error;
  }
};

/**
 * Check if a user is currently logged in
 * @returns {Boolean} - True if user is logged in
 */
export const isLoggedIn = () => {
  return !!localStorage.getItem('token');
};

/**
 * Get authentication token
 * @returns {String|null} - JWT token or null if not logged in
 */
export const getToken = () => {
  return localStorage.getItem('token');
};

export default {
  register,
  login,
  logout,
  getCurrentUser,
  isLoggedIn,
  getToken,
};