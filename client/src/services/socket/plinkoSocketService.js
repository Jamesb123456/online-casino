import { io } from 'socket.io-client';
import { getSocketBaseUrl } from './socketUtils';

class PlinkoSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.namespace = '/plinko';
    this.apiUrl = getSocketBaseUrl();
  }

  /**
   * Initialize socket connection to plinko namespace
   */
  connect() {
    if (!this.socket) {
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
   * Start a plinko game with a bet
   * @param {number} amount - Bet amount
   * @param {number} rows - Number of rows in the plinko board
   * @param {string} risk - Risk level ('low', 'medium', 'high')
   */
  startGame(amount, rows, risk) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('plinko:drop_ball', { betAmount: amount, rows, risk });
  }

  /**
   * Listen for game started event
   * @param {Function} callback 
   */
  onGameStarted(callback) {
    if (!this.socket) return () => {};
    this.socket.on('gameStarted', callback);
    return () => { if (this.socket) this.socket.off('gameStarted', callback); };
  }

  /**
   * Listen for ball position update
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onBallUpdate(callback) {
    if (!this.socket) return () => {};
    this.socket.on('ballUpdate', callback);
    return () => { if (this.socket) this.socket.off('ballUpdate', callback); };
  }

  /**
   * Listen for game result
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onGameResult(callback) {
    if (!this.socket) return () => {};
    this.socket.on('plinko:game_result', callback);
    return () => { if (this.socket) this.socket.off('plinko:game_result', callback); };
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
   * Listen for plinko path reveal
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onPathReveal(callback) {
    if (!this.socket) return () => {};
    this.socket.on('pathReveal', callback);
    return () => { if (this.socket) this.socket.off('pathReveal', callback); };
  }

  /**
   * Listen for history update
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onHistoryUpdate(callback) {
    if (!this.socket) return () => {};
    this.socket.on('historyUpdate', callback);
    return () => { if (this.socket) this.socket.off('historyUpdate', callback); };
  }

  /**
   * Listen for error event
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onError(callback) {
    if (!this.socket) return () => {};
    this.socket.on('plinko:error', callback);
    return () => { if (this.socket) this.socket.off('plinko:error', callback); };
  }
}

// Export singleton instance
const plinkoSocketService = new PlinkoSocketService();
export default plinkoSocketService;