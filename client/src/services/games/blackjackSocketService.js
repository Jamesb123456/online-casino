import socketService from '../socketService';

/**
 * Blackjack Socket Service
 * Handles real-time communication with the server for the blackjack game
 */
class BlackjackSocketService {
  constructor() {
    this.socket = null;
    this.gameStateListener = null;
    this.namespace = '/blackjack';
  }

  /**
   * Connect to the blackjack socket namespace
   */
  connect() {
    this.socket = socketService.getSocket(this.namespace);
    
    if (this.socket) {
      console.log('Connected to blackjack namespace');
      
      // Setup reconnection logic
      this.socket.on('disconnect', () => {
        console.log('Disconnected from blackjack namespace');
      });
      
      this.socket.on('connect', () => {
        console.log('Reconnected to blackjack namespace');
      });
    } else {
      console.error('Failed to connect to blackjack namespace');
    }
    
    return this.socket;
  }
  
  /**
   * Disconnect from the blackjack socket namespace
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
  
  /**
   * Listen for game state updates from the server
   * @param {Function} callback - Function to call when game state updates
   */
  onGameState(callback) {
    if (!this.socket) this.connect();
    
    this.gameStateListener = callback;
    this.socket.on('gameState', (data) => {
      if (this.gameStateListener) {
        this.gameStateListener(data);
      }
    });
  }
  
  /**
   * Place a bet and start the game
   * @param {Number} amount - Bet amount
   */
  placeBet(amount) {
    if (!this.socket) this.connect();
    
    this.socket.emit('placeBet', { amount });
  }
  
  /**
   * Request to hit (draw another card)
   */
  hit() {
    if (!this.socket) this.connect();
    
    this.socket.emit('hit');
  }
  
  /**
   * Request to stand (end turn)
   */
  stand() {
    if (!this.socket) this.connect();
    
    this.socket.emit('stand');
  }
  
  /**
   * Request to double down (double bet, draw one card, then stand)
   */
  double() {
    if (!this.socket) this.connect();
    
    this.socket.emit('double');
  }
  
  /**
   * Request to split hand (when having two cards of the same value)
   */
  split() {
    if (!this.socket) this.connect();
    
    this.socket.emit('split');
  }
  
  /**
   * Request a new card from the server
   * @returns {Promise} Promise that resolves with the new card
   */
  requestCard() {
    return new Promise((resolve) => {
      if (!this.socket) this.connect();
      
      this.socket.emit('requestCard');
      this.socket.once('card', (card) => {
        resolve(card);
      });
    });
  }
}

export default new BlackjackSocketService();