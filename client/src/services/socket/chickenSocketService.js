import { io } from 'socket.io-client';
import { getToken } from '../authService';

/**
 * Socket.IO service for the Chicken game
 * Manages real-time communication with the server for game events
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

class ChickenSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = {};
  }

  /**
   * Connect to the Chicken game socket namespace
   */
  connect() {
    if (this.socket) return;

    const token = getToken();
    
    this.socket = io(`${API_URL}/chicken`, {
      autoConnect: true,
      withCredentials: true,
      auth: token ? { token } : undefined
    });

    // Set up connection event handlers
    this.socket.on('connect', () => {
      console.log('Connected to chicken socket');
      this.isConnected = true;
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from chicken socket');
      this.isConnected = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('Chicken socket connection error:', error);
      this.isConnected = false;
    });

    // Set up game event handlers
    this.setupEventHandlers();
  }

  /**
   * Disconnect from the socket server
   */
  disconnect() {
    if (!this.socket) return;
    
    this.socket.disconnect();
    this.socket = null;
    this.isConnected = false;
  }

  /**
   * Setup standard game event handlers
   */
  setupEventHandlers() {
    if (!this.socket) return;

    // Game events that might need global handling
    const events = [
      'game_started',
      'multiplier_update',
      'game_ended',
      'player_cashed_out',
      'auto_cash_out',
      'balance_update'
    ];

    events.forEach(event => {
      this.socket.on(event, (data) => {
        // Notify all registered listeners for this event
        if (this.listeners[event]) {
          this.listeners[event].forEach(callback => callback(data));
        }
      });
    });
  }

  /**
   * Register a listener for a specific event
   * 
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  /**
   * Remove a listener for a specific event
   * 
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove (optional)
   */
  off(event, callback) {
    if (!this.listeners[event]) return;
    
    if (callback) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    } else {
      delete this.listeners[event];
    }
  }

  /**
   * Place a bet in the Chicken game
   * 
   * @param {Object} betData - Bet data
   * @param {number} betData.betAmount - Amount to bet
   * @param {number} betData.autoCashOutMultiplier - Multiplier to auto cash out at (optional)
   * @param {string} betData.difficulty - Game difficulty level
   * @returns {Promise} - Promise resolving to the server response
   */
  placeBet(betData) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        return reject(new Error('Not connected to server'));
      }

      this.socket.emit('place_bet', betData, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to place bet'));
        }
      });
    });
  }

  /**
   * Cash out from the current game
   * 
   * @returns {Promise} - Promise resolving to the server response
   */
  cashOut() {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        return reject(new Error('Not connected to server'));
      }

      this.socket.emit('cash_out', {}, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to cash out'));
        }
      });
    });
  }

  /**
   * Get game history
   * 
   * @param {number} count - Number of history items to retrieve
   * @returns {Promise} - Promise resolving to the server response
   */
  getGameHistory(count = 10) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        return reject(new Error('Not connected to server'));
      }

      this.socket.emit('get_history', { count }, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.error || 'Failed to get game history'));
        }
      });
    });
  }
}

// Create singleton instance
const chickenSocketService = new ChickenSocketService();

export default chickenSocketService;