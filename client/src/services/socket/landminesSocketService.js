import { io } from 'socket.io-client';
import { getSocketBaseUrl } from './socketUtils';

// Socket state managed at module level
let socket = null;
let isConnected = false;

const NAMESPACE = '/landmines';
const API_URL = getSocketBaseUrl();

/**
 * Connect to the landmines namespace socket.
 * Returns a Promise that resolves when the socket is connected
 * and rejects after a 5-second timeout.
 * @returns {Promise<void>}
 */
const connect = () => {
  return new Promise((resolve, reject) => {
    // If already connected, resolve immediately
    if (socket && isConnected) {
      return resolve();
    }

    // If socket exists but not connected, disconnect and reconnect
    if (socket) {
      socket.disconnect();
      socket = null;
    }

    socket = io(`${API_URL}${NAMESPACE}`, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: true,
    });

    // Set a connection timeout
    const connectionTimeout = setTimeout(() => {
      if (!isConnected) {
        reject(new Error('Connection timeout'));
      }
    }, 5000);

    socket.on('connect', () => {
      isConnected = true;
      clearTimeout(connectionTimeout);
      resolve();
    });

    socket.on('connect_error', (error) => {
      isConnected = false;
      clearTimeout(connectionTimeout);
      reject(error);
    });

    socket.on('disconnect', () => {
      isConnected = false;
    });
  });
};

/**
 * Disconnect the landmines socket and clean up
 */
const disconnect = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    isConnected = false;
  }
};

/**
 * Join the landmines game room
 * @param {Function} callback - Callback function with response data
 */
const joinLandminesGame = (callback) => {
  if (!socket) {
    if (callback) callback({ success: false, message: 'Socket not connected' });
    return;
  }
  socket.emit('landmines:join', {}, callback);
};

/**
 * Leave the landmines game room
 */
const leaveLandminesGame = () => {
  if (socket) {
    socket.emit('landmines:leave');
  }
};

/**
 * Start a new landmines game
 * @param {Object} gameData - Game settings (betAmount, mines)
 * @param {Function} callback - Callback function with response data
 */
const startGame = (gameData, callback) => {
  if (!socket) {
    if (callback) callback({ success: false, message: 'Socket not connected' });
    return;
  }
  socket.emit('landmines:start', gameData, callback);
};

/**
 * Pick a cell on the landmines grid
 * @param {Object} pickData - Cell position data (row, col)
 * @param {Function} callback - Callback function with response data
 */
const pickCell = (pickData, callback) => {
  if (!socket) {
    if (callback) callback({ success: false, message: 'Socket not connected' });
    return;
  }
  socket.emit('landmines:pick', pickData, callback);
};

/**
 * Cash out current game
 * @param {Function} callback - Callback function with response data
 */
const cashOut = (callback) => {
  if (!socket) {
    if (callback) callback({ success: false, message: 'Socket not connected' });
    return;
  }
  socket.emit('landmines:cashout', {}, callback);
};

/**
 * Get game history
 * @param {Object} options - Options like limit of history items
 * @param {Function} callback - Callback function with response data
 */
const getGameHistory = (options, callback) => {
  if (!socket) {
    if (callback) callback({ success: false, message: 'Socket not connected' });
    return;
  }
  socket.emit('landmines:get_history', options, callback);
};

/**
 * Subscribe to player cashout events
 * @param {Function} callback - Callback function with event data
 * @returns {Function} Unsubscribe function
 */
const onPlayerCashout = (callback) => {
  if (!socket) return () => {};
  socket.on('landmines:player_cashout', callback);
  return () => { socket.off('landmines:player_cashout', callback); };
};

/**
 * Listen for balance updates from server
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
const onBalanceUpdate = (callback) => {
  if (!socket) return () => {};
  socket.on('balanceUpdate', callback);
  return () => { socket.off('balanceUpdate', callback); };
};

export default {
  connect,
  disconnect,
  joinLandminesGame,
  leaveLandminesGame,
  startGame,
  pickCell,
  cashOut,
  getGameHistory,
  onPlayerCashout,
  onBalanceUpdate,
};
