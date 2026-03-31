/**
 * Wheel Game Socket Handler - LIVE multiplayer version
 * Automated game loop: betting phase → spin → results → repeat
 * All players share the same wheel and see the same spin result.
 */
import BalanceService from '../services/balanceService.js';
import LoggingService from '../services/loggingService.js';
import { validateSocketData, wheelPlaceBetSchema } from '../validation/schemas.js';
import crypto from 'crypto';

// ── Constants ──────────────────────────────────────────────────────────
const BETTING_DURATION = parseInt(process.env.WHEEL_BETTING_DURATION || '10');   // seconds
const SPIN_DURATION = parseInt(process.env.WHEEL_SPIN_DURATION || '5000');      // ms for spin animation
const RESULT_DISPLAY = parseInt(process.env.WHEEL_RESULT_DISPLAY || '4000');    // ms to show results
const MAX_HISTORY = 100;

// Fixed shared wheel segments (medium difficulty)
const WHEEL_SEGMENTS = [
  { multiplier: 0.2, color: '#e74c3c', label: '0.2x' },   // Red
  { multiplier: 1,   color: '#f1c40f', label: '1x' },      // Yellow
  { multiplier: 0.5, color: '#e67e22', label: '0.5x' },    // Orange
  { multiplier: 2,   color: '#3498db', label: '2x' },      // Blue
  { multiplier: 0.2, color: '#e74c3c', label: '0.2x' },    // Red
  { multiplier: 1,   color: '#f1c40f', label: '1x' },      // Yellow
  { multiplier: 3,   color: '#2ecc71', label: '3x' },      // Green
  { multiplier: 0.2, color: '#e74c3c', label: '0.2x' },    // Red
  { multiplier: 1,   color: '#f1c40f', label: '1x' },      // Yellow
  { multiplier: 0.5, color: '#e67e22', label: '0.5x' },    // Orange
  { multiplier: 5,   color: '#9b59b6', label: '5x' },      // Purple
  { multiplier: 2,   color: '#3498db', label: '2x' },      // Blue
];

// ── Main Handler ──────────────────────────────────────────────────────

export default function initWheelHandlers(namespace) {
  const gameState = {
    phase: 'waiting' as 'betting' | 'spinning' | 'result' | 'waiting',
    roundId: null as string | null,
    countdown: 0,
    bets: new Map<number, any>(),   // userId → { amount, username }
    result: null as any,
    timer: null as any,
  };

  const connectedUsers = new Map();   // userId → { socket, username }
  const activePlayers = new Map();    // userId → player info
  const gameHistory: any[] = [];

  // ── Connection handling ──────────────────────────────────────────────

  namespace.on('connection', (socket) => {
    const user = (socket as any).user;
    if (!user) { socket.disconnect(); return; }

    const userId = user.userId;
    const username = user.username;

    connectedUsers.set(userId, { socket, username });
    activePlayers.set(userId, { id: userId, username, avatar: null, joinedAt: Date.now() });

    // Send full game state
    socket.emit('wheel:gameState', {
      phase: gameState.phase,
      countdown: gameState.countdown,
      roundId: gameState.roundId,
      segments: WHEEL_SEGMENTS,
      history: gameHistory.slice(-10),
      currentBets: allBetsFlat(),
      activePlayers: Array.from(activePlayers.values()),
    });

    if (gameState.phase === 'spinning' && gameState.result) {
      socket.emit('wheelSpinning', {
        roundId: gameState.roundId,
        targetAngle: gameState.result.targetAngle,
        segments: WHEEL_SEGMENTS,
      });
    }

    socket.emit('wheel:activePlayers', Array.from(activePlayers.values()));
    socket.broadcast.emit('wheel:playerJoined', { id: userId, username, avatar: null, joinedAt: Date.now() });

    // ── Client events ─────────────────────────────────────────────────

    socket.on('wheel:join', (_data, callback) => {
      if (callback) callback({ success: true, segments: WHEEL_SEGMENTS, history: gameHistory.slice(-10) });
    });

    socket.on('wheel:place_bet', async (data, callback) => {
      try {
        if (gameState.phase !== 'betting') {
          return callback?.({ success: false, error: 'Betting is closed' });
        }

        const validated = validateSocketData(wheelPlaceBetSchema, data);
        const { betAmount } = validated;

        if (gameState.bets.has(userId)) {
          return callback?.({ success: false, error: 'You already placed a bet this round' });
        }

        // Deduct via BalanceService
        await BalanceService.placeBet(userId, betAmount, 'wheel', {
          roundId: gameState.roundId,
        });

        const newBalance = await BalanceService.getBalance(userId);

        gameState.bets.set(userId, { userId, username, amount: betAmount, timestamp: new Date() });

        socket.emit('balanceUpdate', { balance: newBalance });

        const betInfo = { userId, username, amount: betAmount, timestamp: new Date() };
        namespace.emit('wheel:playerBet', betInfo);

        callback?.({ success: true, balance: newBalance });
      } catch (error: any) {
        LoggingService.logGameEvent('wheel', 'error_place_bet', { error: error.message, userId });
        callback?.({ success: false, error: error.message });
      }
    });

    socket.on('wheel:get_history', (data, callback) => {
      callback?.({ success: true, globalHistory: gameHistory.slice(-(data?.limit || 10)) });
    });

    socket.on('disconnect', () => {
      connectedUsers.delete(userId);
      activePlayers.delete(userId);
      namespace.emit('wheel:playerLeft', { id: userId, username });
    });
  });

  // ── Game loop ───────────────────────────────────────────────────────

  function startBettingPhase() {
    gameState.phase = 'betting';
    gameState.roundId = `wheel_${Date.now()}`;
    gameState.countdown = BETTING_DURATION;
    gameState.bets = new Map();
    gameState.result = null;

    namespace.emit('gameStarting', { countdown: BETTING_DURATION, roundId: gameState.roundId, segments: WHEEL_SEGMENTS });
    namespace.emit('countdown', { countdown: gameState.countdown });

    gameState.timer = setInterval(() => {
      gameState.countdown--;
      namespace.emit('countdown', { countdown: gameState.countdown });
      if (gameState.countdown <= 0) {
        clearInterval(gameState.timer);
        gameState.timer = null;
        startSpinPhase();
      }
    }, 1000);
  }

  function startSpinPhase() {
    gameState.phase = 'spinning';

    // Generate result
    const segmentIndex = crypto.randomInt(WHEEL_SEGMENTS.length);
    const segment = WHEEL_SEGMENTS[segmentIndex];

    // Calculate animation angle
    const segmentAngle = 360 / WHEEL_SEGMENTS.length;
    const baseRotation = 270;
    const targetAngle = baseRotation - (segmentIndex * segmentAngle);
    const randomOffset = Math.random() * (segmentAngle * 0.6) - (segmentAngle * 0.3);
    const fullRotations = 4 * 360;
    const finalAngle = targetAngle + randomOffset + fullRotations;

    gameState.result = {
      segmentIndex,
      multiplier: segment.multiplier,
      color: segment.color,
      targetAngle: finalAngle,
    };

    namespace.emit('wheelSpinning', {
      roundId: gameState.roundId,
      targetAngle: finalAngle,
      segments: WHEEL_SEGMENTS,
    });

    LoggingService.logGameEvent('wheel', 'spin_started', { roundId: gameState.roundId });

    setTimeout(() => processResults(), SPIN_DURATION);
  }

  async function processResults() {
    gameState.phase = 'result';
    const { segmentIndex, multiplier, color } = gameState.result;

    // Process each player's bet
    for (const [userId, bet] of gameState.bets) {
      const winAmount = bet.amount * multiplier;
      const profit = winAmount - bet.amount;

      if (winAmount > 0) {
        try {
          await BalanceService.recordWin(userId, bet.amount, winAmount, 'wheel', {
            multiplier, segmentIndex, roundId: gameState.roundId,
          });
        } catch (err) {
          LoggingService.logGameEvent('wheel', 'error_recording_win', { error: String(err), userId });
        }
      }

      const conn = connectedUsers.get(userId);
      if (conn?.socket) {
        try {
          const newBalance = await BalanceService.getBalance(userId);
          conn.socket.emit('balanceUpdate', { balance: newBalance });
        } catch (_) { /* ignore */ }

        conn.socket.emit('wheel:personal_result', {
          betAmount: bet.amount, multiplier, winAmount, profit,
        });
      }
    }

    // Global result
    const gameResult = {
      roundId: gameState.roundId,
      segmentIndex, multiplier, color,
      timestamp: new Date(),
    };
    gameHistory.push(gameResult);
    if (gameHistory.length > MAX_HISTORY) gameHistory.splice(0, gameHistory.length - MAX_HISTORY);

    namespace.emit('wheel:game_result', {
      roundId: gameState.roundId,
      segmentIndex, multiplier, color,
      timestamp: new Date(),
    });

    LoggingService.logGameEvent('wheel', 'spin_result', {
      roundId: gameState.roundId, multiplier, segmentIndex,
    });

    setTimeout(() => {
      namespace.emit('wheel:round_complete', { message: 'Ready for new bets', timestamp: new Date() });
      startBettingPhase();
    }, RESULT_DISPLAY);
  }

  function allBetsFlat() {
    return Array.from(gameState.bets.values());
  }

  // ── Start ───────────────────────────────────────────────────────────
  LoggingService.logGameEvent('wheel', 'service_initialized', { timestamp: new Date() });
  startBettingPhase();

  return {
    getGameState: () => ({ ...gameState }),
    getGameHistory: () => [...gameHistory],
  };
}

export { initWheelHandlers };
