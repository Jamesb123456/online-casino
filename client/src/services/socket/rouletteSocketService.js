import { io } from 'socket.io-client';

class RouletteSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.namespace = '/roulette';
    this.apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
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
        console.log('Already connected to roulette socket server');
        return resolve();
      }
      
      // If socket exists but not connected, disconnect and reconnect
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }
      
      console.log(`Connecting to roulette socket at ${this.apiUrl}${this.namespace}`);
      
      // Use provided userInfo or fallback to this.user
      const user = userInfo || this.user || {};
      
      this.socket = io(`${this.apiUrl}${this.namespace}`, {
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        auth: {
          userId: user.userId,
          username: user.username,
          avatar: user.avatar
        }
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
        console.log('Connected to roulette socket server');
        this.isConnected = true;
        clearTimeout(connectionTimeout);
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from roulette socket server');
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        console.error('Roulette socket connection error:', error);
        reject(error);
      });

      this.socket.on('error', (error) => {
        console.error('Roulette socket error:', error);
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
   * @param {number} amount - Bet amount
   * @param {string} type - Bet type (straight, split, corner, etc.)
   * @param {number|string} value - Bet value (number, color, etc.)
   */
  placeBet(amount, type, value) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('placeBet', { amount, type, value });
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
    console.log('[Socket] Checking connection status, isConnected:', this.isConnected);
    if (this.socket && this.isConnected) {
      console.log('[Socket] Already connected.');
      return Promise.resolve();
    }
    
    console.log('[Socket] Not connected, attempting to reconnect...');
    try {
      await this.connect();
      console.log('[Socket] Reconnection successful, isConnected:', this.isConnected);
      return Promise.resolve();
    } catch (error) {
      console.error('[Socket] Reconnection failed:', error);
      return Promise.reject(error);
    }
  }
  
  /**
   * Debug method to check socket connection status
   * @returns {Object} Connection status details
   */
  debugConnection() {
    const status = {
      socketExists: !!this.socket,
      isConnected: this.isConnected,
      socketId: this.socket?.id || null,
      namespace: this.namespace,
      apiUrl: this.apiUrl
    };
    
    console.log('[Socket Debug] Connection status:', status);
    return status;
  }

  /**
   * Spin the roulette wheel with specified bet amount
   * @param {Object} bets - Array of bet objects with type, value, amount
   * @returns {Promise} Promise that resolves when wheel starts spinning
   */
  async spin(bets) {
    try {
      console.log('[Socket] Spin requested, checking connection first...');
      // Ensure we have a connection before spinning
      await this.ensureConnected();
      
      return new Promise((resolve, reject) => {
        if (!this.socket || !this.isConnected) {
          console.error('[Socket] Still not connected after ensureConnected()!');
          return reject(new Error('Socket not connected'));
        }
        
        // Convert any numbers to strings
        const formattedBets = bets.map(bet => ({
          ...bet,
          value: String(bet.value)
        }));
        
        console.log('[Socket] Emitting roulette:spin event with bets:', formattedBets);
        
        // Set a timeout in case the server never responds
        const timeout = setTimeout(() => {
          console.error('[Socket] Spin request timed out after 10s');
          reject(new Error('Spin request timed out'));
        }, 10000);
        
        this.socket.emit('roulette:spin', { bets: formattedBets }, (response) => {
          clearTimeout(timeout);
          if (response && response.success) {
            console.log('[Socket] Spin successful:', response);
            resolve(response);
          } else {
            console.error('[Socket] Spin error:', response?.error || 'Unknown error');
            reject(new Error(response?.error || 'Error spinning wheel'));
          }
        });
      });
    } catch (error) {
      console.error('[Socket] Spin error:', error);
      throw error;
    }
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
    console.log('[Socket] Setting up roulette:spin_started listener');
    this.socket.on('roulette:spin_started', (data) => {
      console.log('[Socket] Received roulette:spin_started event:', data);
      callback(data);
    });
  }

  /**
   * Listen for spin result event (final phase with winning number)
   * @param {Function} callback 
   */
  onSpinResult(callback) {
    console.log('[Socket] Setting up roulette:spin_result listener');
    this.socket.on('roulette:spin_result', (data) => {
      console.log('[Socket] Received roulette:spin_result event:', data);
      callback(data);
    });
  }

  /**
   * Listen for round complete event
   * @param {Function} callback - Callback function to handle the event
   */
  onRoundComplete(callback) {
    console.log('[Socket] Setting up roulette:round_complete listener');
    this.socket.on('roulette:round_complete', (data) => {
      console.log('[Socket] Received roulette:round_complete event:', data);
      callback(data);
    });
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
}

// Export singleton instance
const rouletteSocketService = new RouletteSocketService();
export default rouletteSocketService;