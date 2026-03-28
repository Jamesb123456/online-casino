/**
 * Base API service for handling HTTP requests
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/**
 * Helper for making authenticated API requests
 */
export const apiRequest = async (endpoint, options = {}) => {
  // Set up headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Build query string from params option (Axios-style)
  let url = `${API_URL}${endpoint}`;
  if (options.params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
    delete options.params;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Include cookies in requests
    });

    // For non-204 responses, try to parse JSON
    const data = response.status !== 204 
      ? await response.json() 
      : {};

    // If response is not ok, throw error with message from API
    if (!response.ok) {
      const errorMessage = data.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }
    
    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

/**
 * Common HTTP methods
 */
export const api = {
  get: (endpoint, options = {}) => {
    return apiRequest(endpoint, { ...options, method: 'GET' });
  },
  
  post: (endpoint, data, options = {}) => {
    return apiRequest(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  put: (endpoint, data, options = {}) => {
    return apiRequest(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  delete: (endpoint, options = {}) => {
    return apiRequest(endpoint, { ...options, method: 'DELETE' });
  },
};

export default api;