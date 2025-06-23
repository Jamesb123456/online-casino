import { io } from 'socket.io-client';

class PlinkoSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.namespace = '/plinko';
    this.apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  }

  /**
   * Initialize socket connection to plinko namespace
   */
  connect() {
    if (!this.socket) {
      console.log(`Connecting to plinko socket at ${this.apiUrl}${this.namespace}`);
      
      this.socket = io(`${this.apiUrl}${this.namespace}`, {
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      // Socket connection event listeners
      this.socket.on('connect', () => {
        console.log('Connected to plinko socket server');
        this.isConnected = true;
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from plinko socket server');
        this.isConnected = false;
      });

      this.socket.on('error', (error) => {
        console.error('Plinko socket error:', error);
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
    this.socket.emit('startGame', { amount, rows, risk });
  }

  /**
   * Listen for game started event
   * @param {Function} callback 
   */
  onGameStarted(callback) {
    if (!this.socket) return;
    this.socket.on('gameStarted', callback);
  }

  /**
   * Listen for ball position update
   * @param {Function} callback 
   */
  onBallUpdate(callback) {
    if (!this.socket) return;
    this.socket.on('ballUpdate', callback);
  }

  /**
   * Listen for game result
   * @param {Function} callback 
   */
  onGameResult(callback) {
    if (!this.socket) return;
    this.socket.on('gameResult', callback);
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
   * Listen for plinko path reveal
   * @param {Function} callback 
   */
  onPathReveal(callback) {
    if (!this.socket) return;
    this.socket.on('pathReveal', callback);
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
}

// Export singleton instance
const plinkoSocketService = new PlinkoSocketService();
export default plinkoSocketService;