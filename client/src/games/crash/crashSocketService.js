/**
 * Crash game specific socket service for real-time game updates
 */
import { 
  getSocket, 
  onSocketEvent, 
  emitSocketEvent 
} from '../../services/socketService';

// Event names
const CRASH_EVENTS = {
  // Server to client events
  GAME_STATE: 'crash:gameState',
  GAME_STARTING: 'crash:gameStarting',
  GAME_STARTED: 'crash:gameStarted',
  GAME_CRASHED: 'crash:gameCrashed',
  MULTIPLIER_UPDATE: 'crash:multiplierUpdate',
  BET_PLACED: 'crash:betPlaced',
  BET_CASHED_OUT: 'crash:betCashedOut',
  
  // Client to server events
  JOIN_GAME: 'crash:joinGame',
  LEAVE_GAME: 'crash:leaveGame',
  PLACE_BET: 'crash:placeBet',
  CASH_OUT: 'crash:cashOut',
};

/**
 * Subscribe to game state updates
 * @param {Function} callback - Called on game state change
 * @returns {Function} - Unsubscribe function
 */
export const onGameStateChange = (callback) => {
  return onSocketEvent(CRASH_EVENTS.GAME_STATE, callback);
};

/**
 * Subscribe to multiplier updates
 * @param {Function} callback - Called on multiplier updates
 * @returns {Function} - Unsubscribe function
 */
export const onMultiplierUpdate = (callback) => {
  return onSocketEvent(CRASH_EVENTS.MULTIPLIER_UPDATE, callback);
};

/**
 * Subscribe to game starting countdown
 * @param {Function} callback - Called when game is about to start
 * @returns {Function} - Unsubscribe function
 */
export const onGameStarting = (callback) => {
  return onSocketEvent(CRASH_EVENTS.GAME_STARTING, callback);
};

/**
 * Subscribe to game started event
 * @param {Function} callback - Called when game starts
 * @returns {Function} - Unsubscribe function
 */
export const onGameStarted = (callback) => {
  return onSocketEvent(CRASH_EVENTS.GAME_STARTED, callback);
};

/**
 * Subscribe to game crash event
 * @param {Function} callback - Called when game crashes
 * @returns {Function} - Unsubscribe function
 */
export const onGameCrashed = (callback) => {
  return onSocketEvent(CRASH_EVENTS.GAME_CRASHED, callback);
};

/**
 * Subscribe to bet placed events
 * @param {Function} callback - Called when a bet is placed
 * @returns {Function} - Unsubscribe function
 */
export const onBetPlaced = (callback) => {
  return onSocketEvent(CRASH_EVENTS.BET_PLACED, callback);
};

/**
 * Subscribe to cash out events
 * @param {Function} callback - Called when a bet is cashed out
 * @returns {Function} - Unsubscribe function
 */
export const onBetCashedOut = (callback) => {
  return onSocketEvent(CRASH_EVENTS.BET_CASHED_OUT, callback);
};

/**
 * Join the crash game room
 */
export const joinCrashGame = () => {
  emitSocketEvent(CRASH_EVENTS.JOIN_GAME);
};

/**
 * Leave the crash game room
 */
export const leaveCrashGame = () => {
  emitSocketEvent(CRASH_EVENTS.LEAVE_GAME);
};

/**
 * Send a bet to the server
 * @param {Object} betData - Bet data including amount and auto cashout
 * @param {Function} callback - Optional callback for server acknowledgement
 */
export const placeBet = (betData, callback) => {
  emitSocketEvent(CRASH_EVENTS.PLACE_BET, betData, callback);
};

/**
 * Send cash out request to the server
 * @param {Object} data - Cash out data (bet ID)
 * @param {Function} callback - Optional callback for server acknowledgement
 */
export const cashOut = (data, callback) => {
  emitSocketEvent(CRASH_EVENTS.CASH_OUT, data, callback);
};

export default {
  CRASH_EVENTS,
  onGameStateChange,
  onMultiplierUpdate,
  onGameStarting,
  onGameStarted,
  onGameCrashed,
  onBetPlaced,
  onBetCashedOut,
  joinCrashGame,
  leaveCrashGame,
  placeBet,
  cashOut
};