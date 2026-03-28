import { io } from 'socket.io-client';
import { getSocketBaseUrl } from './socketUtils';

class CrashSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.namespace = '/crash';
    this.apiUrl = getSocketBaseUrl();
    this.currentUser = null;
  }
  
  /**
   * Set current user information for socket authentication
   * @param {Object} user - User information
   */
  setUser(user) {
    this.currentUser = user;
  }

  /**
   * Initialize socket connection to crash namespace
   * @param {Object} userInfo - Optional user information (username, avatar)
   */
  connect(userInfo = null) {
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

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
      });

      this.socket.on('connect_error', (error) => {
        if (error.message && error.message.includes('Authentication')) {
          this.socket.emit('authenticationError', error.message);
        }
      });

      this.socket.on('error', () => {});
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
   * Join the crash game room
   * @returns {Promise} Resolves when joined
   */
  joinCrashGame() {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        this.connect();
      }
      
      if (!this.isConnected) {
        this.socket.on('connect', () => {
          resolve();
        });
        
        // Set a timeout to reject if connection takes too long
        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error('Connection timeout'));
          }
        }, 5000);
      } else {
        resolve();
      }
    });
  }
  
  /**
   * Leave the crash game room
   */
  leaveCrashGame() {
    if (this.socket) {
      this.disconnect();
    }
  }

  // NOTE: The primary placeBet and cashOut methods with callback support
  // are defined further below in this class. The legacy no-callback versions
  // have been removed to avoid duplicate method definitions.

  /**
   * Listen for game starting event
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onGameStarting(callback) {
    if (!this.socket) return () => {};
    const socketRef = this.socket;
    socketRef.on('gameStarting', callback);
    return () => socketRef && socketRef.off('gameStarting', callback);
  }

  /**
   * Listen for game started event
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onGameStarted(callback) {
    if (!this.socket) return () => {};
    const socketRef = this.socket;
    socketRef.on('gameStarted', callback);
    return () => socketRef && socketRef.off('gameStarted', callback);
  }

  /**
   * Listen for game tick event (multiplier updates)
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onGameTick(callback) {
    if (!this.socket) return () => {};
    const socketRef = this.socket;
    socketRef.on('gameTick', callback);
    return () => socketRef && socketRef.off('gameTick', callback);
  }

  /**
   * Listen for crash event
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onGameCrashed(callback) {
    if (!this.socket) return () => {};
    const socketRef = this.socket;
    socketRef.on('gameCrashed', callback);
    return () => socketRef && socketRef.off('gameCrashed', callback);
  }

  /**
   * Listen for player betting events
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onPlayerBet(callback) {
    if (!this.socket) return () => {};
    const socketRef = this.socket;
    socketRef.on('playerBet', callback);
    return () => socketRef && socketRef.off('playerBet', callback);
  }

  /**
   * Listen for player cashout events
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onPlayerCashout(callback) {
    if (!this.socket) return () => {};
    const socketRef = this.socket;
    socketRef.on('playerCashout', callback);
    return () => socketRef && socketRef.off('playerCashout', callback);
  }
  
  /**
   * Listen for active players list updates
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onActivePlayers(callback) {
    if (!this.socket) return () => {};
    const socketRef = this.socket;
    socketRef.on('activePlayers', callback);
    return () => socketRef && socketRef.off('activePlayers', callback);
  }
  
  /**
   * Listen for player joined events
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onPlayerJoined(callback) {
    if (!this.socket) return () => {};
    const socketRef = this.socket;
    socketRef.on('playerJoined', callback);
    return () => socketRef && socketRef.off('playerJoined', callback);
  }
  
  /**
   * Listen for player left events
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onPlayerLeft(callback) {
    if (!this.socket) return () => {};
    const socketRef = this.socket;
    socketRef.on('playerLeft', callback);
    return () => socketRef && socketRef.off('playerLeft', callback);
  }
  
  /**
   * Listen for current bets update
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onCurrentBets(callback) {
    if (!this.socket) return () => {};
    const socketRef = this.socket;
    socketRef.on('currentBets', callback);
    return () => socketRef && socketRef.off('currentBets', callback);
  }

  /**
   * Listen for balance update event
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onBalanceUpdate(callback) {
    if (!this.socket) return () => {};
    const socketRef = this.socket;
    socketRef.on('balanceUpdate', callback);
    return () => socketRef && socketRef.off('balanceUpdate', callback);
  }

  /**
   * Listen for error event
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onError(callback) {
    if (!this.socket) return () => {};
    const socketRef = this.socket;
    socketRef.on('error', callback);
    return () => socketRef && socketRef.off('error', callback);
  }

  /**
   * Listen for game history update
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onHistoryUpdate(callback) {
    if (!this.socket) return () => {};
    const socketRef = this.socket;
    socketRef.on('historyUpdate', callback);
    return () => socketRef && socketRef.off('historyUpdate', callback);
  }

  /**
   * Listen for game state change
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onGameStateChange(callback) {
    if (!this.socket) return () => {};
    const socketRef = this.socket;
    socketRef.on('gameState', callback);
    return () => socketRef && socketRef.off('gameState', callback);
  }

  /**
   * Listen for multiplier updates
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onMultiplierUpdate(callback) {
    if (!this.socket) return () => {};
    const socketRef = this.socket;
    socketRef.on('multiplierUpdate', callback);
    return () => socketRef && socketRef.off('multiplierUpdate', callback);
  }

  /**
   * Listen for socket connection errors
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onConnectError(callback) {
    if (!this.socket) return () => {};
    const socketRef = this.socket;
    socketRef.on('connect_error', callback);
    return () => socketRef && socketRef.off('connect_error', callback);
  }

  /**
   * Remove listener for socket connection errors
   * @param {Function} callback 
   */
  offConnectError(callback) {
    if (this.socket) {
      this.socket.off('connect_error', callback);
    }
  }

  /**
   * Place a bet in the crash game
   * @param {Object} betData - Bet data (amount, autoCashout/autoCashoutAt)
   * @param {Function} callback - Response callback
   */
  placeBet(betData, callback) {
    if (!this.socket) {
      if (callback) callback({ success: false, message: 'Socket not connected' });
      return;
    }

    // Normalise field name: server expects autoCashoutAt, client may send autoCashout
    const payload = typeof betData === 'object' && betData !== null
      ? { amount: betData.amount, autoCashoutAt: betData.autoCashout ?? betData.autoCashoutAt }
      : betData;
    this.socket.emit('placeBet', payload, callback);
  }
  
  /**
   * Cash out from the current game
   * @param {Object} data - Cashout data (betId, etc)
   * @param {Function} callback - Response callback
   */
  cashOut(data, callback) {
    if (!this.socket) {
      if (callback) callback({ success: false, message: 'Socket not connected' });
      return;
    }
    
    this.socket.emit('cashOut', data, callback);
  }
}

// Export singleton instance
const crashSocketService = new CrashSocketService();
export default crashSocketService;