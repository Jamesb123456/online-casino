import { io } from 'socket.io-client';

class WheelSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.namespace = '/wheel';
    this.apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  }

  /**
   * Initialize socket connection to wheel namespace
   */
  connect() {
    if (!this.socket) {
      console.log(`Connecting to wheel socket at ${this.apiUrl}${this.namespace}`);
      
      this.socket = io(`${this.apiUrl}${this.namespace}`, {
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      // Socket connection event listeners
      this.socket.on('connect', () => {
        console.log('Connected to wheel socket server');
        this.isConnected = true;
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from wheel socket server');
        this.isConnected = false;
      });

      this.socket.on('error', (error) => {
        console.error('Wheel socket error:', error);
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
   * Place a bet on the wheel
   * @param {number} amount - Bet amount
   * @param {string} segment - Segment color or type to bet on
   */
  placeBet(amount, segment) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('placeBet', { amount, segment });
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
}

// Export singleton instance
const wheelSocketService = new WheelSocketService();
export default wheelSocketService;