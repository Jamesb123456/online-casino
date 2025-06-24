import { io } from 'socket.io-client';

class CrashSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.namespace = '/crash';
    this.apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'; // Using port 5000 to match server
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
      console.log(`Connecting to crash socket at ${this.apiUrl}${this.namespace}`);
      
      // Merge provided userInfo with stored currentUser data
      const authData = {
        userId: (userInfo?.userId || this.currentUser?.id || `user_${Date.now()}`),
        username: (userInfo?.username || this.currentUser?.username || `Player_${Math.floor(Math.random() * 10000)}`),
        avatar: (userInfo?.avatar || this.currentUser?.avatar || null)
      };
      
      this.socket = io(`${this.apiUrl}${this.namespace}`, {
        transports: ['websocket'],
        autoConnect: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        auth: authData
      });

      // Socket connection event listeners
      this.socket.on('connect', () => {
        console.log('Connected to crash socket server');
        this.isConnected = true;
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from crash socket server');
        this.isConnected = false;
      });

      this.socket.on('error', (error) => {
        console.error('Crash socket error:', error);
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
   * Join the crash game room
   * @returns {Promise} Resolves when joined
   */
  joinCrashGame() {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        this.connect();
      }
      
      if (!this.isConnected) {
        console.log('Connecting to crash game...');
        this.socket.on('connect', () => {
          console.log('Connected, joining crash game room');
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

  /**
   * Place a bet in the crash game
   * @param {number} amount - Bet amount
   * @param {number} autoCashout - Auto cashout multiplier (optional)
   */
  placeBet(amount, autoCashout = null) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('placeBet', { amount, autoCashout });
  }

  /**
   * Cashout from the current round
   */
  cashout() {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('cashout');
  }

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

  // Nothing here - duplicate methods removed
  
  /**
   * Place a bet in the crash game
   * @param {Object} betData - Bet data (amount, autoCashout)
   * @param {Function} callback - Response callback
   */
  placeBet(betData, callback) {
    if (!this.socket) {
      if (callback) callback({ success: false, message: 'Socket not connected' });
      return;
    }
    
    this.socket.emit('placeBet', betData, callback);
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