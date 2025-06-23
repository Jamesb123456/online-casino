import socketService from '../../services/socketService';

/**
 * Roulette Game Socket Service
 * Handles all socket.io events related to the Roulette game
 */
class RouletteSocketService {
  constructor() {
    this.socket = null;
    this.eventHandlers = {};
    this.gameNamespace = 'roulette';
  }

  /**
   * Connect to the Roulette game socket namespace
   * @param {Object} user - User information including auth token
   * @returns {Promise} - Resolves when connected
   */
  connect(user = null) {
    return socketService.connectToNamespace(this.gameNamespace, user);
  }

  /**
   * Subscribe to roulette game events
   * @param {String} event - Event name to subscribe to
   * @param {Function} handler - Event handler function
   */
  on(event, handler) {
    this.eventHandlers[event] = handler;
    socketService.on(`${this.gameNamespace}:${event}`, handler);
  }

  /**
   * Unsubscribe from roulette game events
   * @param {String} event - Event name to unsubscribe from
   */
  off(event) {
    if (this.eventHandlers[event]) {
      socketService.off(`${this.gameNamespace}:${event}`, this.eventHandlers[event]);
      delete this.eventHandlers[event];
    }
  }

  /**
   * Join the roulette game session
   * @returns {Promise} - Resolves with game state data
   */
  joinGame() {
    return socketService.emit(`${this.gameNamespace}:join`);
  }

  /**
   * Leave the roulette game session
   */
  leaveGame() {
    return socketService.emit(`${this.gameNamespace}:leave`);
  }

  /**
   * Place a bet on the roulette table
   * @param {Object} betData - Bet information (type, value, amount)
   * @returns {Promise} - Resolves with bet confirmation
   */
  placeBet(betData) {
    return socketService.emit(`${this.gameNamespace}:place_bet`, betData);
  }

  /**
   * Spin the roulette wheel
   * @returns {Promise} - Resolves with spin result
   */
  spinWheel() {
    return socketService.emit(`${this.gameNamespace}:spin`);
  }

  /**
   * Get the game history
   * @param {Number} limit - Number of history items to retrieve
   * @returns {Promise} - Resolves with game history
   */
  getGameHistory(limit = 10) {
    return socketService.emit(`${this.gameNamespace}:get_history`, { limit });
  }

  /**
   * Disconnect from the roulette game socket
   */
  disconnect() {
    Object.keys(this.eventHandlers).forEach(event => {
      this.off(event);
    });
    socketService.leaveNamespace(this.gameNamespace);
  }
}

// Export as a singleton
const rouletteSocketService = new RouletteSocketService();
export default rouletteSocketService;