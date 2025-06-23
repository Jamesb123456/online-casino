import { io } from 'socket.io-client';

class CrashSocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.namespace = '/crash';
    this.apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
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
   */
  onGameStarting(callback) {
    if (!this.socket) return;
    this.socket.on('gameStarting', callback);
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
   * Listen for game tick event (multiplier updates)
   * @param {Function} callback 
   */
  onGameTick(callback) {
    if (!this.socket) return;
    this.socket.on('gameTick', callback);
  }

  /**
   * Listen for crash event
   * @param {Function} callback 
   */
  onGameCrashed(callback) {
    if (!this.socket) return;
    this.socket.on('gameCrashed', callback);
  }

  /**
   * Listen for player betting events
   * @param {Function} callback 
   */
  onPlayerBet(callback) {
    if (!this.socket) return;
    this.socket.on('playerBet', callback);
  }

  /**
   * Listen for player cashout events
   * @param {Function} callback 
   */
  onPlayerCashout(callback) {
    if (!this.socket) return;
    this.socket.on('playerCashout', callback);
  }
  
  /**
   * Listen for active players list updates
   * @param {Function} callback 
   */
  onActivePlayers(callback) {
    if (!this.socket) return;
    this.socket.on('activePlayers', callback);
  }
  
  /**
   * Listen for player joined events
   * @param {Function} callback 
   */
  onPlayerJoined(callback) {
    if (!this.socket) return;
    this.socket.on('playerJoined', callback);
  }
  
  /**
   * Listen for player left events
   * @param {Function} callback 
   */
  onPlayerLeft(callback) {
    if (!this.socket) return;
    this.socket.on('playerLeft', callback);
  }
  
  /**
   * Listen for current bets update
   * @param {Function} callback 
   */
  onCurrentBets(callback) {
    if (!this.socket) return;
    this.socket.on('currentBets', callback);
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

  /**
   * Listen for game history update
   * @param {Function} callback 
   */
  onHistoryUpdate(callback) {
    if (!this.socket) return;
    this.socket.on('historyUpdate', callback);
  }
}

// Export singleton instance
const crashSocketService = new CrashSocketService();
export default crashSocketService;