/**
 * Shared socket utilities for all game socket services.
 */

/**
 * Get the base URL for Socket.IO connections.
 * Strips trailing /api from the configured URL since Socket.IO connects to the base host.
 * Checks VITE_SOCKET_URL first, then VITE_API_URL, then falls back to localhost.
 * @returns {string} Base URL for socket connections
 */
export function getSocketBaseUrl() {
  return (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000')
    .replace(/\/api\/?$/, '');
}
