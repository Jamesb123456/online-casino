/**
 * Plinko game specific socket service for real-time game updates
 */
import { 
  getSocket, 
  onSocketEvent, 
  emitSocketEvent 
} from '../../services/socketService';

// Event names
const PLINKO_EVENTS = {
  // Server to client events
  GAME_RESULT: 'plinko:gameResult',
  
  // Client to server events
  JOIN_GAME: 'plinko:joinGame',
  LEAVE_GAME: 'plinko:leaveGame',
  DROP_BALL: 'plinko:dropBall',
};

/**
 * Subscribe to game result updates
 * @param {Function} callback - Called when a game result is received
 * @returns {Function} - Unsubscribe function
 */
export const onGameResult = (callback) => {
  return onSocketEvent(PLINKO_EVENTS.GAME_RESULT, callback);
};

/**
 * Join the Plinko game room
 */
export const joinPlinkoGame = () => {
  emitSocketEvent(PLINKO_EVENTS.JOIN_GAME);
};

/**
 * Leave the Plinko game room
 */
export const leavePlinkoGame = () => {
  emitSocketEvent(PLINKO_EVENTS.LEAVE_GAME);
};

/**
 * Send a drop ball request to the server
 * @param {Object} betData - Bet data including amount and risk level
 * @param {Function} callback - Optional callback for server acknowledgement
 */
export const dropBall = (betData, callback) => {
  emitSocketEvent(PLINKO_EVENTS.DROP_BALL, betData, callback);
};

export default {
  PLINKO_EVENTS,
  onGameResult,
  joinPlinkoGame,
  leavePlinkoGame,
  dropBall
};