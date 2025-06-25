import api from '../api';

/**
 * Admin Service
 * Handles all API requests related to admin functionality
 */
class AdminService {
  /**
   * Get dashboard overview statistics
   * @returns {Promise} Promise object with dashboard data
   */
  async getDashboardStats() {
    try {
      const response = await api.get('/admin/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get game statistics with optional filters
   * @param {Object} filters - Optional filters like timeRange and gameType
   * @returns {Promise} Promise object with filtered game stats
   */
  async getGameStats(filters = {}) {
    try {
      const response = await api.get('/admin/stats/games', { params: filters });
      return response.data;
    } catch (error) {
      console.error('Error fetching game stats:', error);
      throw error;
    }
  }

  /**
   * Get game history
   * @param {Object} params - Parameters like limit, page, gameId
   * @returns {Promise} Promise object with game history data
   */
  async getGameHistory(params = {}) {
    try {
      const response = await api.get('/admin/games/history', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching game history:', error);
      throw error;
    }
  }

  // Player Management

  /**
   * Get all players
   * @param {Object} params - Query parameters for filtering and sorting
   * @param {number} params.limit - Maximum number of results to return
   * @param {number} params.page - Page number for pagination
   * @param {string} params.searchTerm - Text to search for in usernames
   * @param {string} params.sortBy - Field to sort by (e.g., 'username', 'balance', 'createdAt')
   * @param {string} params.sortDir - Sort direction ('asc' or 'desc')
   * @param {boolean} params.activeOnly - Filter by active users only
   * @param {string} params.role - Filter by user role
   * @returns {Promise} Promise object with players data
   */
  async getPlayers(params = {}) {
    try {
      const response = await api.get('/admin/users', { params });
      // Format the response to match what the component expects
      if (Array.isArray(response.data)) {
        return {
          players: response.data,
          totalCount: response.data.length
        };
      }
      return response.data;
    } catch (error) {
      console.error('Error fetching players:', error);
      throw error;
    }
  }

  /**
   * Get a single player by ID
   * @param {string} playerId - Player ID
   * @returns {Promise} Promise object with player data
   */
  async getPlayerById(playerId) {
    try {
      const response = await api.get(`/admin/users/${playerId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching player ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new player
   * @param {Object} playerData - Player data including username, password, etc.
   * @returns {Promise} Promise object with created player data
   */
  async createPlayer(playerData) {
    try {
      const response = await api.post('/admin/users', playerData);
      return response.data;
    } catch (error) {
      console.error('Error creating player:', error);
      throw error;
    }
  }

  /**
   * Update a player
   * @param {string} playerId - Player ID
   * @param {Object} playerData - Updated player data
   * @returns {Promise} Promise object with updated player data
   */
  async updatePlayer(playerId, playerData) {
    try {
      const response = await api.put(`/admin/users/${playerId}`, playerData);
      return response.data;
    } catch (error) {
      console.error(`Error updating player ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a player
   * @param {string} playerId - Player ID
   * @returns {Promise} Promise object with deletion confirmation
   */
  async deletePlayer(playerId) {
    try {
      const response = await api.delete(`/admin/users/${playerId}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting player ${playerId}:`, error);
      throw error;
    }
  }

  // Balance Management

  /**
   * Add funds to a player's balance
   * @param {string} playerId - Player ID
   * @param {number} amount - Amount to add
   * @returns {Promise} Promise object with updated balance info
   */
  async addFunds(playerId, amount) {
    try {
      const response = await api.post(`/admin/players/${playerId}/balance/add`, { amount });
      return response.data;
    } catch (error) {
      console.error(`Error adding funds to player ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Remove funds from a player's balance
   * @param {string} playerId - Player ID
   * @param {number} amount - Amount to remove
   * @returns {Promise} Promise object with updated balance info
   */
  async removeFunds(playerId, amount) {
    try {
      const response = await api.post(`/admin/players/${playerId}/balance/remove`, { amount });
      return response.data;
    } catch (error) {
      console.error(`Error removing funds from player ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Get transactions history
   * @param {Object} params - Parameters like limit, page, userId, type
   * @returns {Promise} Promise object with transactions data
   */
  async getTransactions(params = {}) {
    try {
      const response = await api.get('/admin/transactions', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  // System Management

  /**
   * Get system logs
   * @param {Object} params - Parameters like limit, page, level
   * @returns {Promise} Promise object with system logs
   */
  async getSystemLogs(params = {}) {
    try {
      const response = await api.get('/admin/system/logs', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching system logs:', error);
      throw error;
    }
  }

  /**
   * Update system settings
   * @param {Object} settings - New system settings
   * @returns {Promise} Promise object with updated settings
   */
  async updateSystemSettings(settings) {
    try {
      const response = await api.put('/admin/system/settings', settings);
      return response.data;
    } catch (error) {
      console.error('Error updating system settings:', error);
      throw error;
    }
  }
}

const adminService = new AdminService();
export default adminService;