import { io } from 'socket.io-client';

class BlackjackSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.namespace = '/blackjack';
    this.apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  }

  /**
   * Initialize socket connection to blackjack namespace
   */
  connect() {
    if (!this.socket) {
      console.log(`Connecting to blackjack socket at ${this.apiUrl}${this.namespace}`);
      
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
        console.log('Connected to blackjack socket server');
        this.isConnected = true;
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from blackjack socket server');
        this.isConnected = false;
      });

      this.socket.on('error', (error) => {
        console.error('Blackjack socket error:', error);
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