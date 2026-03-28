import { io } from 'socket.io-client';
import { getSocketBaseUrl } from './socketUtils';

class RouletteSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.namespace = '/roulette';
    this.apiUrl = getSocketBaseUrl();
    this.user = null;
  }
  
  /**
   * Set current user information for authentication
   * @param {Object} user - User information with userId, username, avatar
   */
  setUser(user) {
    this.user = user;
  }

  /**
   * Initialize socket connection to roulette namespace
   * @param {Object} userInfo - Optional user info to override this.user
   * @returns {Promise} Promise that resolves when connection is established
   */
  connect(userInfo = null) {
    return new Promise((resolve, reject) => {
      // If already connected, resolve immediately
      if (this.socket && this.isConnected) {
        return resolve();
      }
      
      // If socket exists but not connected, disconnect and reconnect
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      
      // Use provided userInfo or fallback to this.user
      const user = userInfo || this.user || {};
      
      this.socket = io(`${this.apiUrl}${this.namespace}`, {
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        withCredentials: true,
      });

      // Set a connection timeout
      const connectionTimeout = setTimeout(() => {
        if (!this.isConnected) {
          console.error('Connection timeout to roulette socket server');
          reject(new Error('Connection timeout'));
        }
      }, 5000); // 5 second timeout

      // Socket connection event listeners
      this.socket.on('connect', () => {
        this.isConnected = true;
        clearTimeout(connectionTimeout);
        resolve();
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Disconnect from socket
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  /**
   * Place a bet on roulette
   * @param {Object} betData - Bet data with type, value, amount
   * @returns {Promise} Promise that resolves with the server response
   */
  placeBet(betData) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        return reject(new Error('Socket not connected'));
      }

      this.socket.emit('placeBet', betData, (response) => {
        if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to place bet'));
        }
      });
    });
  }

  /**
   * Clear all current bets
   */
  clearBets() {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('clearBets');
  }

  /**
   * Join the roulette game room and get initial game data
   * @returns {Promise} Promise that resolves with game data
   */
  joinGame() {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        return reject(new Error('Socket not connected'));
      }
      
      this.socket.emit('roulette:join', {}, (response) => {
        if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error('Failed to join game' + (response?.message ? ': ' + response.message : '')));
        }
      });
    });
  }

  /**
   * Check and ensure socket connection is active
   * @returns {Promise} Promise that resolves when connection is established
   */
  async ensureConnected() {
    if (this.socket && this.isConnected) {
      return;
    }
    await this.connect();
  }

  /**
   * Spin the roulette wheel with specified bet amount
   * @param {Object} bets - Array of bet objects with type, value, amount
   * @returns {Promise} Promise that resolves when wheel starts spinning
   */
  async spin(bets) {
    await this.ensureConnected();

    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        return reject(new Error('Socket not connected'));
      }

      const formattedBets = bets.map(bet => ({
        ...bet,
        value: String(bet.value)
      }));

      const timeout = setTimeout(() => {
        reject(new Error('Spin request timed out'));
      }, 10000);

      this.socket.emit('roulette:spin', { bets: formattedBets }, (response) => {
        clearTimeout(timeout);
        if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Error spinning wheel'));
        }
      });
    });
  }

  /**
   * Listen for countdown event
   * @param {Function} callback 
   */
  onCountdown(callback) {
    if (!this.socket) return;
    this.socket.on('countdown', callback);
  }

  /**
   * Listen for betting phase start event
   * @param {Function} callback 
   */
  onBettingStart(callback) {
    if (!this.socket) return;
    this.socket.on('bettingStart', callback);
  }

  /**
   * Listen for betting phase end event
   * @param {Function} callback 
   */
  onBettingEnd(callback) {
    if (!this.socket) return;
    this.socket.on('bettingEnd', callback);
  }

  /**
   * Listen for spin started event
   * @param {Function} callback - Callback function to handle the event
   */
  onSpinStarted(callback) {
    if (!this.socket) return;
    this.socket.on('roulette:spin_started', callback);
  }

  /**
   * Listen for spin result event (final phase with winning number)
   * @param {Function} callback
   */
  onSpinResult(callback) {
    if (!this.socket) return;
    this.socket.on('roulette:spin_result', callback);
  }

  /**
   * Listen for round complete event
   * @param {Function} callback
   */
  onRoundComplete(callback) {
    if (!this.socket) return;
    this.socket.on('roulette:round_complete', callback);
  }

  /**
   * Listen for game results (legacy event)
   * @param {Function} callback 
   */
  onGameResult(callback) {
    if (!this.socket) return;
    this.socket.on('roulette:game_result', callback);
  }

  /**
   * Listen for player bets update
   * @param {Function} callback 
   */
  onPlayerBets(callback) {
    if (!this.socket) return;
    this.socket.on('playerBets', callback);
  }

  /**
   * Listen for bet confirmations
   * @param {Function} callback 
   */
  onBetConfirmed(callback) {
    if (!this.socket) return;
    this.socket.on('betConfirmed', callback);
  }

  /**
   * Listen for balance update event
   * @param {Function} callback 
   */
  onBalanceUpdate(callback) {
    if (!this.socket) return;
    this.socket.on('balanceUpdate', callback);
  }

  /**
   * Listen for history update
   * @param {Function} callback 
   */
  onHistoryUpdate(callback) {
    if (!this.socket) return;
    this.socket.on('historyUpdate', callback);
  }

  /**
   * Listen for error event
   * @param {Function} callback 
   */
  onError(callback) {
    if (!this.socket) return;
    this.socket.on('error', callback);
  }
  
  /**
   * Listen for active players list update
   * @param {Function} callback 
   */
  onActivePlayers(callback) {
    if (!this.socket) return;
    this.socket.on('roulette:activePlayers', callback);
  }
  
  /**
   * Listen for player joined event
   * @param {Function} callback 
   */
  onPlayerJoined(callback) {
    if (!this.socket) return;
    this.socket.on('roulette:playerJoined', callback);
  }
  
  /**
   * Listen for player left event
   * @param {Function} callback 
   */
  onPlayerLeft(callback) {
    if (!this.socket) return;
    this.socket.on('roulette:playerLeft', callback);
  }
  
  /**
   * Listen for player bet event
   * @param {Function} callback 
   */
  onPlayerBet(callback) {
    if (!this.socket) return;
    this.socket.on('roulette:playerBet', callback);
  }
  
  /**
   * Listen for current bets update
   * @param {Function} callback
   */
  onCurrentBets(callback) {
    if (!this.socket) return;
    this.socket.on('roulette:currentBets', callback);
  }

  /**
   * Generic event listener that delegates to the underlying socket
   * @param {string} event - Event name
   * @param {Function} callback - Event handler
   */
  on(event, callback) {
    if (!this.socket) return;
    this.socket.on(event, callback);
  }

  /**
   * Remove a generic event listener from the underlying socket
   * @param {string} event - Event name
   * @param {Function} [callback] - Event handler to remove; if omitted, removes all listeners for the event
   */
  off(event, callback) {
    if (!this.socket) return;
    if (callback) {
      this.socket.off(event, callback);
    } else {
      this.socket.off(event);
    }
  }
}

// Export singleton instance
const rouletteSocketService = new RouletteSocketService();
export default rouletteSocketService;