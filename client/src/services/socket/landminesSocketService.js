import { io } from 'socket.io-client';
import { getSocketBaseUrl } from './socketUtils';

// Socket state managed at module level
let socket = null;
let isConnected = false;

const NAMESPACE = '/landmines';
const API_URL = getSocketBaseUrl();

/**
 * Ensure the landmines namespace socket is connected
 * @returns {Object} The socket instance
 */
const ensureSocket = () => {
  if (!socket) {
    socket = io(`${API_URL}${NAMESPACE}`, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      withCredentials: true,
    });

    socket.on('connect', () => {
      isConnected = true;
    });

    socket.on('connect_error', () => {
      isConnected = false;
    });

    socket.on('disconnect', () => {
      isConnected = false;
    });
  }
  return socket;
};

/**
 * Disconnect the landmines socket
 */
const disconnectSocket = () => {
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
  ensureSocket().emit('landmines:join', {}, callback);
};

/**
 * Leave the landmines game room
 */
const leaveLandminesGame = () => {
  ensureSocket().emit('landmines:leave');
};

/**
 * Start a new landmines game
 * @param {Object} gameData - Game settings (betAmount, mines)
 * @param {Function} callback - Callback function with response data
 */
const startGame = (gameData, callback) => {
  ensureSocket().emit('landmines:start', gameData, callback);
};

/**
 * Pick a cell on the landmines grid
 * @param {Object} pickData - Cell position data (row, col)
 * @param {Function} callback - Callback function with response data
 */
const pickCell = (pickData, callback) => {
  ensureSocket().emit('landmines:pick', pickData, callback);
};

/**
 * Cash out current game
 * @param {Function} callback - Callback function with response data
 */
const cashOut = (callback) => {
  ensureSocket().emit('landmines:cashout', {}, callback);
};

/**
 * Get game history
 * @param {Object} options - Options like limit of history items
 * @param {Function} callback - Callback function with response data
 */
const getGameHistory = (options, callback) => {
  ensureSocket().emit('landmines:get_history', options, callback);
};

/**
 * Subscribe to player cashout events
 * @param {Function} callback - Callback function with event data
 * @returns {Function} Unsubscribe function
 */
const onPlayerCashout = (callback) => {
  const s = ensureSocket();
  s.on('landmines:player_cashout', callback);
  return () => { s.off('landmines:player_cashout', callback); };
};

/**
 * Listen for balance updates from server
 * @param {Function} callback
 * @returns {Function} Unsubscribe function
 */
const onBalanceUpdate = (callback) => {
  const s = ensureSocket();
  s.on('balanceUpdate', callback);
  return () => { s.off('balanceUpdate', callback); };
};

export default {
  ensureSocket,
  disconnectSocket,
  joinLandminesGame,
  leaveLandminesGame,
  startGame,
  pickCell,
  cashOut,
  getGameHistory,
  onPlayerCashout,
  onBalanceUpdate,
};
