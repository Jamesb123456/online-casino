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

    // Try to parse JSON; if the response is empty or non-JSON (e.g. a
    // rate-limit plain-text response or an HTML error page), fall back to a
    // synthesized error so callers can still pattern-match on the status.
    let data = {};
    if (response.status !== 204) {
      const text = await response.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = { message: `HTTP ${response.status}: ${response.statusText}` };
        }
      }
    }

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