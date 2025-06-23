import socketService from '../../services/socketService';

/**
 * Wheel Game Socket Service
 * Handles all socket.io events related to the Wheel game
 */
class WheelSocketService {
  constructor() {
    this.socket = null;
    this.eventHandlers = {};
    this.gameNamespace = 'wheel';
  }

  /**
   * Connect to the Wheel game socket namespace
   * @param {Object} user - User information including auth token
   * @returns {Promise} - Resolves when connected
   */
  connect(user = null) {
    return socketService.connectToNamespace(this.gameNamespace, user);
  }

  /**
   * Subscribe to wheel game events
   * @param {String} event - Event name to subscribe to
   * @param {Function} handler - Event handler function
   */
  on(event, handler) {
    this.eventHandlers[event] = handler;
    socketService.on(`${this.gameNamespace}:${event}`, handler);
  }

  /**
   * Unsubscribe from wheel game events
   * @param {String} event - Event name to unsubscribe from
   */
  off(event) {
    if (this.eventHandlers[event]) {
      socketService.off(`${this.gameNamespace}:${event}`, this.eventHandlers[event]);
      delete this.eventHandlers[event];
    }
  }

  /**
   * Join the wheel game session
   * @returns {Promise} - Resolves with game state data
   */
  joinGame() {
    return socketService.emit(`${this.gameNamespace}:join`);
  }

  /**
   * Leave the wheel game session
   */
  leaveGame() {
    return socketService.emit(`${this.gameNamespace}:leave`);
  }

  /**
   * Place a bet on the wheel
   * @param {Object} betData - Bet information (amount, difficulty)
   * @returns {Promise} - Resolves with bet confirmation
   */
  placeBet(betData) {
    return socketService.emit(`${this.gameNamespace}:place_bet`, betData);
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
   * Disconnect from the wheel game socket
   */
  disconnect() {
    Object.keys(this.eventHandlers).forEach(event => {
      this.off(event);
    });
    socketService.leaveNamespace(this.gameNamespace);
  }
}

// Export as a singleton
const wheelSocketService = new WheelSocketService();
export default wheelSocketService;