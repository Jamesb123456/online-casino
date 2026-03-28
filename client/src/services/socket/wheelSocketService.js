import { io } from 'socket.io-client';
import { getSocketBaseUrl } from './socketUtils';

class WheelSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.namespace = '/wheel';
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
   * Initialize socket connection to wheel namespace
   * @param {Object} userInfo - Optional user info to override this.user
   */
  connect(userInfo = null) {
    if (!this.socket) {
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

      // Socket connection event listeners
      this.socket.on('connect', () => {
        this.isConnected = true;
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
      });
    }
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
   * Place a bet on the wheel and spin
   * @param {Object} betData - Bet data including amount, difficulty, and segments
   * @returns {Promise} Promise that resolves with the server spin result
   */
  placeBet(betData) {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        return reject(new Error('Socket not connected'));
      }

      this.socket.emit('wheel:placeBet', betData, (response) => {
        if (response && response.success) {
          resolve(response);
        } else {
          reject(new Error(response?.error || 'Failed to place bet'));
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
   * Listen for game starting event
   * @param {Function} callback 
   */
  onGameStarting(callback) {
    if (!this.socket) return;
    this.socket.on('gameStarting', callback);
  }

  /**
   * Listen for wheel spinning event
   * @param {Function} callback 
   */
  onWheelSpinning(callback) {
    if (!this.socket) return;
    this.socket.on('wheelSpinning', callback);
  }

  /**
   * Listen for game result event
   * @param {Function} callback 
   */
  onGameResult(callback) {
    if (!this.socket) return;
    this.socket.on('gameResult', callback);
  }

  /**
   * Listen for player bets event
   * @param {Function} callback 
   */
  onPlayerBets(callback) {
    if (!this.socket) return;
    this.socket.on('playerBets', callback);
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
    this.socket.on('wheel:activePlayers', callback);
  }
  
  /**
   * Listen for player joined event
   * @param {Function} callback 
   */
  onPlayerJoined(callback) {
    if (!this.socket) return;
    this.socket.on('wheel:playerJoined', callback);
  }
  
  /**
   * Listen for player left event
   * @param {Function} callback 
   */
  onPlayerLeft(callback) {
    if (!this.socket) return;
    this.socket.on('wheel:playerLeft', callback);
  }
  
  /**
   * Listen for player bet event
   * @param {Function} callback 
   */
  onPlayerBet(callback) {
    if (!this.socket) return;
    this.socket.on('wheel:playerBet', callback);
  }
  
  /**
   * Listen for current bets update
   * @param {Function} callback 
   */
  onCurrentBets(callback) {
    if (!this.socket) return;
    this.socket.on('wheel:currentBets', callback);
  }
}

// Export singleton instance
const wheelSocketService = new WheelSocketService();
export default wheelSocketService;