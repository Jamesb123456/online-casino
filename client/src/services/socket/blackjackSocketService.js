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
   * Place a bet to start the game
   * @param {number} amount - Bet amount
   */
  placeBet(amount) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('placeBet', { amount });
  }

  /**
   * Hit action - draw another card
   */
  hit() {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('hit');
  }

  /**
   * Stand action - end turn
   */
  stand() {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('stand');
  }

  /**
   * Double down action
   */
  doubleDown() {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('doubleDown');
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
   * Listen for card dealt event
   * @param {Function} callback 
   */
  onCardDealt(callback) {
    if (!this.socket) return;
    this.socket.on('cardDealt', callback);
  }

  /**
   * Listen for player turn event
   * @param {Function} callback 
   */
  onPlayerTurn(callback) {
    if (!this.socket) return;
    this.socket.on('playerTurn', callback);
  }

  /**
   * Listen for dealer turn event
   * @param {Function} callback 
   */
  onDealerTurn(callback) {
    if (!this.socket) return;
    this.socket.on('dealerTurn', callback);
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
   * Listen for balance update event
   * @param {Function} callback 
   */
  onBalanceUpdate(callback) {
    if (!this.socket) return;
    this.socket.on('balanceUpdate', callback);
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
const blackjackSocketService = new BlackjackSocketService();
export default blackjackSocketService;