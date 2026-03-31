import { io } from 'socket.io-client';
import { getSocketBaseUrl } from './socketUtils';

class BlackjackSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.namespace = '/blackjack';
    this.apiUrl = getSocketBaseUrl();
  }

  /**
   * Initialize socket connection to blackjack namespace
   * @returns {Promise} Resolves when connected, rejects on timeout or error
   */
  connect() {
    if (this.socket?.connected) return Promise.resolve();

    return new Promise((resolve, reject) => {
      if (!this.socket) {
        this.socket = io(`${this.apiUrl}${this.namespace}`, {
          transports: ['websocket'],
          autoConnect: true,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          withCredentials: true,
        });
      }

      const timeout = setTimeout(() => {
        reject(new Error('Socket connection timeout'));
      }, 5000);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        this.isConnected = true;
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      this.socket.on('disconnect', () => {
        this.isConnected = false;
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
   * Place a bet to start the game
   * @param {number} amount - Bet amount
   */
  placeBet(amount) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('blackjack_start', { betAmount: amount });
  }

  /**
   * Hit action - draw another card
   */
  hit() {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('blackjack_hit');
  }

  /**
   * Stand action - end turn
   */
  stand() {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('blackjack_stand');
  }

  /**
   * Double down action
   */
  doubleDown() {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('blackjack_double');
  }

  /**
   * Listen for game started event
   * @param {Function} callback 
   */
  onGameStarted(callback) {
    if (!this.socket) return () => {};
    this.socket.on('blackjack_game_state', callback);
    return () => { if (this.socket) this.socket.off('blackjack_game_state', callback); };
  }

  /**
   * Listen for game state updates (covers card dealt, player turn, dealer turn, game result)
   * The server sends all state via 'blackjack_game_state'
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onGameState(callback) {
    if (!this.socket) return () => {};
    this.socket.on('blackjack_game_state', callback);
    return () => { if (this.socket) this.socket.off('blackjack_game_state', callback); };
  }

  /**
   * Listen for card dealt event (alias for game state)
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onCardDealt(callback) {
    if (!this.socket) return () => {};
    this.socket.on('blackjack_game_state', callback);
    return () => { if (this.socket) this.socket.off('blackjack_game_state', callback); };
  }

  /**
   * Listen for player turn event (alias for game state)
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onPlayerTurn(callback) {
    if (!this.socket) return () => {};
    this.socket.on('blackjack_game_state', callback);
    return () => { if (this.socket) this.socket.off('blackjack_game_state', callback); };
  }

  /**
   * Listen for dealer turn event (alias for game state)
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onDealerTurn(callback) {
    if (!this.socket) return () => {};
    this.socket.on('blackjack_game_state', callback);
    return () => { if (this.socket) this.socket.off('blackjack_game_state', callback); };
  }

  /**
   * Listen for game result event (alias for game state)
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onGameResult(callback) {
    if (!this.socket) return () => {};
    this.socket.on('blackjack_game_state', callback);
    return () => { if (this.socket) this.socket.off('blackjack_game_state', callback); };
  }

  /**
   * Listen for balance update event
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onBalanceUpdate(callback) {
    if (!this.socket) return () => {};
    this.socket.on('balanceUpdate', callback);
    return () => { if (this.socket) this.socket.off('balanceUpdate', callback); };
  }

  /**
   * Listen for error event
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onError(callback) {
    if (!this.socket) return () => {};
    this.socket.on('blackjack_error', callback);
    return () => { if (this.socket) this.socket.off('blackjack_error', callback); };
  }
}

// Export singleton instance
const blackjackSocketService = new BlackjackSocketService();
export default blackjackSocketService;