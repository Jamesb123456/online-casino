import api from '../api';

/**
 * Analytics Service
 * Handles all API requests for admin analytics dashboards
 * (game analytics, player analytics, revenue metrics).
 */
class AnalyticsService {
  /**
   * Fetch aggregated overview for all games.
   * @param {object} params - Query params (e.g. { period: '7d' })
   */
  async getAllGamesOverview(params = {}) {
    try {
      return await api.get('/admin/analytics/games', { params });
    } catch (error) {
      console.error('Error fetching games overview:', error);
      throw error;
    }
  }

  /**
   * Fetch detailed analytics for a specific game type.
   * @param {string} gameType - e.g. 'crash', 'roulette', 'blackjack'
   * @param {object} params - Query params (e.g. { period: '30d' })
   */
  async getGameDetail(gameType, params = {}) {
    try {
      return await api.get(`/admin/analytics/games/${gameType}`, { params });
    } catch (error) {
      console.error(`Error fetching game detail for ${gameType}:`, error);
      throw error;
    }
  }

  /**
   * Fetch a single player's analytics profile.
   * @param {string} userId
   */
  async getPlayerProfile(userId) {
    try {
      return await api.get(`/admin/analytics/players/${userId}/profile`);
    } catch (error) {
      console.error(`Error fetching player profile for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch session history for a specific player.
   * @param {string} userId
   * @param {object} params - Pagination / filter params
   */
  async getPlayerSessions(userId, params = {}) {
    try {
      return await api.get(`/admin/analytics/players/${userId}/sessions`, { params });
    } catch (error) {
      console.error(`Error fetching player sessions for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Fetch leaderboard of top players by specified criteria.
   * @param {object} params - e.g. { period: '7d', sortBy: 'wagered', limit: 20 }
   */
  async getTopPlayers(params = {}) {
    try {
      return await api.get('/admin/analytics/top-players', { params });
    } catch (error) {
      console.error('Error fetching top players:', error);
      throw error;
    }
  }

  /**
   * Fetch revenue analytics with time-series data.
   * @param {object} params - e.g. { period: '30d', granularity: 'day' }
   */
  async getRevenue(params = {}) {
    try {
      return await api.get('/admin/analytics/revenue', { params });
    } catch (error) {
      console.error('Error fetching revenue analytics:', error);
      throw error;
    }
  }
}

const analyticsService = new AnalyticsService();
export default analyticsService;
