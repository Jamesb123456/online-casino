import api from '../api';

/**
 * Admin Service
 * Handles all API requests related to admin functionality
 */
class AdminService {
  /**
   * Get dashboard overview statistics
   */
  async getDashboardStats() {
    try {
      return await api.get('/admin/dashboard');
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Get game statistics with optional filters
   */
  async getGameStats(filters = {}) {
    try {
      return await api.get('/admin/games', { params: filters });
    } catch (error) {
      console.error('Error fetching game stats:', error);
      throw error;
    }
  }

  // Player Management

  /**
   * Get all players
   */
  async getPlayers(params = {}) {
    try {
      const response = await api.get('/admin/users', { params });
      // Normalize response shape
      if (response.players) return response;
      if (Array.isArray(response)) {
        return { players: response, totalCount: response.length };
      }
      return response;
    } catch (error) {
      console.error('Error fetching players:', error);
      throw error;
    }
  }

  /**
   * Create a new player
   */
  async createPlayer(playerData) {
    try {
      return await api.post('/admin/users', playerData);
    } catch (error) {
      console.error('Error creating player:', error);
      throw error;
    }
  }

  /**
   * Update a player
   */
  async updatePlayer(playerId, playerData) {
    try {
      return await api.put(`/admin/users/${playerId}`, playerData);
    } catch (error) {
      console.error(`Error updating player ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Delete a player
   */
  async deletePlayer(playerId) {
    try {
      return await api.delete(`/admin/users/${playerId}`);
    } catch (error) {
      console.error(`Error deleting player ${playerId}:`, error);
      throw error;
    }
  }

  // Balance Management

  /**
   * Add funds to a player's balance
   */
  async addFunds(playerId, amount) {
    try {
      return await api.post(`/admin/users/${playerId}/balance`, { amount: Math.abs(amount), reason: 'Admin credit' });
    } catch (error) {
      console.error(`Error adding funds to player ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Remove funds from a player's balance
   */
  async removeFunds(playerId, amount) {
    try {
      return await api.post(`/admin/users/${playerId}/balance`, { amount: -Math.abs(amount), reason: 'Admin debit' });
    } catch (error) {
      console.error(`Error removing funds from player ${playerId}:`, error);
      throw error;
    }
  }

  /**
   * Get transactions history
   */
  async getTransactions(params = {}) {
    try {
      return await api.get('/admin/transactions', { params });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }
}

const adminService = new AdminService();
export default adminService;
