import { io } from 'socket.io-client';

class RouletteSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.namespace = '/roulette';
    this.apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
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
   */
  connect(userInfo = null) {
    if (!this.socket) {
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

      // Socket connection event listeners
      this.socket.on('connect', () => {
        console.log('Connected to roulette socket server');
        this.isConnected = true;
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from roulette socket server');
        this.isConnected = false;
      });

      this.socket.on('error', (error) => {
        console.error('Roulette socket error:', error);
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
   * Listen for wheel spinning event
   * @param {Function} callback 
   */
  onWheelSpin(callback) {
    if (!this.socket) return;
    this.socket.on('wheelSpin', callback);
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