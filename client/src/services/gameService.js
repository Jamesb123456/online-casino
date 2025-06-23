/**
 * Game service for interacting with game-related API endpoints
 */
import { api } from './api';

const GAME_ENDPOINTS = {
  LIST_GAMES: '/games',
  GAME_DETAILS: (gameId) => `/games/${gameId}`,
  PLACE_BET: '/games/bet',
  GAME_HISTORY: '/games/history',
  LEADERBOARD: '/games/leaderboard',
};

/**
 * Get list of all available games
 * @returns {Promise} - API response with array of game data
 */
export const getGames = async () => {
  try {
    return await api.get(GAME_ENDPOINTS.LIST_GAMES);
  } catch (error) {
    console.error('Get games error:', error);
    throw error;
  }
};

/**
 * Get details for a specific game
 * @param {String} gameId - ID of the game to fetch
 * @returns {Promise} - API response with game details
 */
export const getGameDetails = async (gameId) => {
  try {
    return await api.get(GAME_ENDPOINTS.GAME_DETAILS(gameId));
  } catch (error) {
    console.error(`Get game ${gameId} details error:`, error);
    throw error;
  }
};

/**
 * Place a bet on a game
 * @param {Object} betData - Bet information (game, amount, etc.)
 * @returns {Promise} - API response with bet results
 */
export const placeBet = async (betData) => {
  try {
    return await api.post(GAME_ENDPOINTS.PLACE_BET, betData);
  } catch (error) {
    console.error('Place bet error:', error);
    throw error;
  }
};

/**
 * Get user's game history
 * @param {Object} filters - Optional filters like game type, date range
 * @returns {Promise} - API response with game history
 */
export const getGameHistory = async (filters = {}) => {
  try {
    // Add filters as query parameters if provided
    const queryString = Object.keys(filters).length 
      ? `?${new URLSearchParams(filters).toString()}`
      : '';
      
    return await api.get(`${GAME_ENDPOINTS.GAME_HISTORY}${queryString}`);
  } catch (error) {
    console.error('Get game history error:', error);
    throw error;
  }
};

/**
 * Get leaderboard data
 * @param {Object} options - Options like timeframe, game type, limit
 * @returns {Promise} - API response with leaderboard data
 */
export const getLeaderboard = async (options = {}) => {
  try {
    // Add options as query parameters if provided
    const queryString = Object.keys(options).length 
      ? `?${new URLSearchParams(options).toString()}`
      : '';
      
    return await api.get(`${GAME_ENDPOINTS.LEADERBOARD}${queryString}`);
  } catch (error) {
    console.error('Get leaderboard error:', error);
    throw error;
  }
};

export default {
  getGames,
  getGameDetails,
  placeBet,
  getGameHistory,
  getLeaderboard,
};