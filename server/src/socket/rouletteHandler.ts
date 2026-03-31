/**
 * Roulette Game Socket Handler - LIVE multiplayer version
 * Automated game loop: betting phase → spin → results → repeat
 * All players share the same game state and see the same spin.
 */
import BalanceService from '../services/balanceService.js';
import LoggingService from '../services/loggingService.js';
import { validateSocketData, roulettePlaceBetSchema } from '../validation/schemas.js';
import crypto from 'crypto';

// ── Constants ──────────────────────────────────────────────────────────
const BETTING_DURATION = parseInt(process.env.ROULETTE_BETTING_DURATION || '15');   // seconds for betting phase
const SPIN_DURATION = parseInt(process.env.ROULETTE_SPIN_DURATION || '10000');     // ms for spin animation (matches client)
const RESULT_DISPLAY = parseInt(process.env.ROULETTE_RESULT_DISPLAY || '5000');    // ms to show results before next round
const MAX_HISTORY = 100;

const ROULETTE_NUMBERS = [
  { number: 0, color: 'green' },
  { number: 32, color: 'red' },  { number: 15, color: 'black' },
  { number: 19, color: 'red' },  { number: 4, color: 'black' },
  { number: 21, color: 'red' },  { number: 2, color: 'black' },
  { number: 25, color: 'red' },  { number: 17, color: 'black' },
  { number: 34, color: 'red' },  { number: 6, color: 'black' },
  { number: 27, color: 'red' },  { number: 13, color: 'black' },
  { number: 36, color: 'red' },  { number: 11, color: 'black' },
  { number: 30, color: 'red' },  { number: 8, color: 'black' },
  { number: 23, color: 'red' },  { number: 10, color: 'black' },
  { number: 5, color: 'red' },   { number: 24, color: 'black' },
  { number: 16, color: 'red' },  { number: 33, color: 'black' },
  { number: 1, color: 'red' },   { number: 20, color: 'black' },
  { number: 14, color: 'red' },  { number: 31, color: 'black' },
  { number: 9, color: 'red' },   { number: 22, color: 'black' },
  { number: 18, color: 'red' },  { number: 29, color: 'black' },
  { number: 7, color: 'red' },   { number: 28, color: 'black' },
  { number: 12, color: 'red' },  { number: 35, color: 'black' },
  { number: 3, color: 'red' },   { number: 26, color: 'black' }
];

const BET_TYPES = {
  STRAIGHT: { name: 'Straight Up', payout: 35 },
  SPLIT:    { name: 'Split',       payout: 17 },
  STREET:   { name: 'Street',      payout: 11 },
  CORNER:   { name: 'Corner',      payout: 8 },
  FIVE:     { name: 'Five',        payout: 6 },
  LINE:     { name: 'Line',        payout: 5 },
  COLUMN:   { name: 'Column',      payout: 2 },
  DOZEN:    { name: 'Dozen',       payout: 2 },
  RED:      { name: 'Red',         payout: 1 },
  BLACK:    { name: 'Black',       payout: 1 },
  ODD:      { name: 'Odd',         payout: 1 },
  EVEN:     { name: 'Even',        payout: 1 },
  LOW:      { name: 'Low',         payout: 1 },
  HIGH:     { name: 'High',        payout: 1 }
};

// ── Helpers ────────────────────────────────────────────────────────────

const getBetNumbers = (betType, value) => {
  switch (betType) {
    case 'STRAIGHT': return [parseInt(value)];
    case 'RED':    return ROULETTE_NUMBERS.filter(n => n.color === 'red').map(n => n.number);
    case 'BLACK':  return ROULETTE_NUMBERS.filter(n => n.color === 'black').map(n => n.number);
    case 'ODD':    return ROULETTE_NUMBERS.filter(n => n.number > 0 && n.number % 2 === 1).map(n => n.number);
    case 'EVEN':   return ROULETTE_NUMBERS.filter(n => n.number > 0 && n.number % 2 === 0).map(n => n.number);
    case 'LOW':    return Array.from({ length: 18 }, (_, i) => i + 1);
    case 'HIGH':   return Array.from({ length: 18 }, (_, i) => i + 19);
    case 'DOZEN':  { const s = parseInt(value) * 12 - 11; return Array.from({ length: 12 }, (_, i) => i + s); }
    case 'COLUMN': { const c = parseInt(value); return Array.from({ length: 12 }, (_, i) => i * 3 + c); }
    default: return [];
  }
};

const isBetWinner = (betType, betValue, winningNumber) =>
  getBetNumbers(betType, betValue).includes(winningNumber);

const calculateWinnings = (betType, betAmount, isWinner) => {
  if (!isWinner) return 0;
  const { payout } = BET_TYPES[betType] || { payout: 0 };
  return betAmount * (payout + 1);
};

const generateSpinResult = () => {
  const index = crypto.randomInt(ROULETTE_NUMBERS.length);
  const r = ROULETTE_NUMBERS[index];
  return { number: r.number, color: r.color, index, timestamp: new Date() };
};

const calculateRotationAngles = (index) => {
  const pocketAngle = 360 / ROULETTE_NUMBERS.length;
  const targetAngle = index * pocketAngle;
  const randomOffset = Math.random() * (pocketAngle * 0.6) - (pocketAngle * 0.3);
  return {
    phase1Angle: 10 * 360,
    phase2Angle: 6 * 360,
    phase3Angle: 2 * 360,
    finalAngle: targetAngle + randomOffset,
    durations: { phase1: 3000, phase2: 4000, phase3: 3000, total: SPIN_DURATION }
  };
};

// ── Main Handler ──────────────────────────────────────────────────────

export default function initRouletteHandlers(namespace) {
  // Shared game state
  const gameState = {
    phase: 'waiting' as 'betting' | 'spinning' | 'result' | 'waiting',
    roundId: null as string | null,
    countdown: 0,
    bets: new Map<number, any[]>(),   // userId → bet[]
    result: null as any,
    spinAngles: null as any,
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

    // Send full game state to the new player
    socket.emit('roulette:gameState', {
      phase: gameState.phase,
      countdown: gameState.countdown,
      roundId: gameState.roundId,
      history: gameHistory.slice(-10),
      currentBets: allBetsFlat(),
      activePlayers: Array.from(activePlayers.values()),
    });

    if (gameState.phase === 'spinning' && gameState.spinAngles) {
      socket.emit('roulette:spin_started', {
        roundId: gameState.roundId,
        spinData: gameState.spinAngles,
      });
    }

    socket.emit('roulette:activePlayers', Array.from(activePlayers.values()));
    socket.broadcast.emit('roulette:playerJoined', { id: userId, username, avatar: null, joinedAt: Date.now() });

    // ── Client events ─────────────────────────────────────────────────

    socket.on('roulette:join', (_data, callback) => {
      if (callback) callback({ success: true, history: gameHistory.slice(-10) });
    });

    socket.on('roulette:place_bet', async (data, callback) => {
      try {
        if (gameState.phase !== 'betting') {
          return callback?.({ success: false, error: 'Betting is closed' });
        }

        const validated = validateSocketData(roulettePlaceBetSchema, data);
        const { type, value, amount } = validated;
        if (!BET_TYPES[type]) throw new Error('Invalid bet type');

        // Deduct via BalanceService
        await BalanceService.placeBet(userId, amount, 'roulette', {
          betType: type, betValue: value, roundId: gameState.roundId,
        });

        const newBalance = await BalanceService.getBalance(userId);

        // Store in shared bets
        if (!gameState.bets.has(userId)) gameState.bets.set(userId, []);
        const bet = {
          id: `${Date.now()}_${userId}`,
          userId, username, type, value: value || '', amount,
          timestamp: new Date(),
        };
        gameState.bets.get(userId)!.push(bet);

        // Balance update for this player
        socket.emit('balanceUpdate', { balance: newBalance });

        // Broadcast bet to all
        namespace.emit('roulette:playerBet', bet);

        callback?.({ success: true, betId: bet.id, balance: newBalance, currentBets: gameState.bets.get(userId) });
      } catch (error: any) {
        LoggingService.logGameEvent('roulette', 'error_place_bet', { error: error.message, userId });
        callback?.({ success: false, error: error.message });
      }
    });

    // Legacy spin event — in live mode, spin is automatic
    socket.on('roulette:spin', (_data, callback) => {
      callback?.({ success: true, message: 'Spin is automated in live mode' });
    });

    socket.on('roulette:get_history', (data, callback) => {
      callback?.({ success: true, globalHistory: gameHistory.slice(-(data?.limit || 10)) });
    });

    socket.on('disconnect', () => {
      connectedUsers.delete(userId);
      activePlayers.delete(userId);
      namespace.emit('roulette:playerLeft', { id: userId, username });
    });
  });

  // ── Game loop ───────────────────────────────────────────────────────

  function startBettingPhase() {
    gameState.phase = 'betting';
    gameState.roundId = `roulette_${Date.now()}`;
    gameState.countdown = BETTING_DURATION;
    gameState.bets = new Map();
    gameState.result = null;
    gameState.spinAngles = null;

    namespace.emit('bettingStart', { countdown: BETTING_DURATION, roundId: gameState.roundId });
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
    namespace.emit('bettingEnd', {});

    const result = generateSpinResult();
    gameState.result = result;

    const angles = calculateRotationAngles(result.index);
    gameState.spinAngles = {
      phase1Angle: angles.phase1Angle,
      phase2Angle: angles.phase2Angle,
      phase3Angle: angles.phase3Angle,
      durations: angles.durations,
    };

    namespace.emit('roulette:spin_started', {
      roundId: gameState.roundId,
      timestamp: new Date(),
      spinData: gameState.spinAngles,
    });

    LoggingService.logGameEvent('roulette', 'spin_started', { roundId: gameState.roundId });

    setTimeout(() => processResults(), SPIN_DURATION);
  }

  async function processResults() {
    gameState.phase = 'result';
    const result = gameState.result;

    // Process each player's bets
    for (const [userId, bets] of gameState.bets) {
      const processedBets = bets.map(bet => {
        const isWinner = isBetWinner(bet.type, bet.value, result.number);
        const winAmount = calculateWinnings(bet.type, bet.amount, isWinner);
        const profit = isWinner ? winAmount - bet.amount : -bet.amount;
        return { ...bet, isWinner, winAmount, profit };
      });

      const totalWinnings = processedBets.reduce((s, b) => s + (b.winAmount || 0), 0);
      const totalBetAmount = bets.reduce((s, b) => s + b.amount, 0);
      const totalProfit = processedBets.reduce((s, b) => s + b.profit, 0);

      if (totalWinnings > 0) {
        try {
          await BalanceService.recordWin(userId, totalBetAmount, totalWinnings, 'roulette', {
            winningNumber: result.number, winningColor: result.color,
            bets: processedBets.map(b => ({ type: b.type, value: b.value, amount: b.amount, isWinner: b.isWinner })),
          });
        } catch (err) {
          LoggingService.logGameEvent('roulette', 'error_recording_win', { error: String(err), userId });
        }
      }

      // Emit balance + personal result to the player
      const conn = connectedUsers.get(userId);
      if (conn?.socket) {
        try {
          const newBalance = await BalanceService.getBalance(userId);
          conn.socket.emit('balanceUpdate', { balance: newBalance });
        } catch (_) { /* ignore */ }

        conn.socket.emit('roulette:personal_result', {
          bets: processedBets, totalWinnings, totalProfit,
        });
      }
    }

    // Global result broadcast
    const gameResult = {
      roundId: gameState.roundId,
      winningNumber: result.number,
      winningColor: result.color,
      timestamp: new Date(),
    };
    gameHistory.push(gameResult);
    if (gameHistory.length > MAX_HISTORY) gameHistory.splice(0, gameHistory.length - MAX_HISTORY);

    namespace.emit('roulette:spin_result', {
      phase: 'result',
      gameId: gameState.roundId,
      winningNumber: result.number,
      winningColor: result.color,
      timestamp: new Date(),
    });

    LoggingService.logGameEvent('roulette', 'spin_result', {
      roundId: gameState.roundId, winningNumber: result.number, winningColor: result.color,
    });

    // Show results, then start next round
    setTimeout(() => {
      namespace.emit('roulette:round_complete', { message: 'Ready for new bets', timestamp: new Date() });
      startBettingPhase();
    }, RESULT_DISPLAY);
  }

  function allBetsFlat() {
    const all: any[] = [];
    for (const bets of gameState.bets.values()) all.push(...bets);
    return all;
  }

  // ── Start ───────────────────────────────────────────────────────────
  LoggingService.logGameEvent('roulette', 'service_initialized', { timestamp: new Date() });
  startBettingPhase();

  return {
    getGameState: () => ({ ...gameState }),
    getGameHistory: () => [...gameHistory],
  };
}

export { initRouletteHandlers };
