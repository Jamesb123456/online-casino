/**
 * Roulette engine — round-based, namespace-wide game loop.
 *
 * Phases: `betting` -> `spinning` -> `result` -> back to `betting`.
 *
 * Inherits `RoundBasedEngine` for the standard round lifecycle (seed mint,
 * bet session debit/credit, payout settlement). The public Socket.IO contract
 * is preserved verbatim from the legacy handler: same event names, same
 * payload keys — see `server/src/socket/rouletteHandler.ts` for the source of
 * truth on the wire format that integration tests assert against.
 *
 * Unique to roulette (vs. crash):
 *   - Players may place MULTIPLE bets per round. We track `gameState.bets`
 *     as a `Map<userId, Bet[]>` and let the base open one `gameSessions` row
 *     per `onBet` invocation. That keeps admin analytics granular but means
 *     payout settlement happens per-session-row in `resolveRound`.
 *   - Spin animation data (multi-phase angles) is broadcast alongside the
 *     winning number so all clients see the same wheel motion.
 */
import { RoundBasedEngine } from '../_engine/rounds.js';
import type { ActiveBet, RoundResolution } from '../_engine/rounds.js';
import pf from '../_engine/provablyFair.js';
import LoggingService from '../../services/loggingService.js';
import GameConfigService from '../../services/gameConfigService.js';
import BalanceService from '../../services/balanceService.js';
import { validateSocketData, roulettePlaceBetSchema } from '../../validation/schemas.js';
import {
  ALL_BET_TYPES,
  BET_TYPES,
  evaluateBet,
  type RouletteBet,
  type RouletteBetType,
} from './payouts.js';
import { drawRouletteSlot, drawFromNumber, spinAngles } from './rng.js';
import type {
  BetResult,
  GameType,
  JoinPayload,
  PersistedSeeds,
  PlayerCtx,
  SeedBundle,
} from '../_engine/types.js';

/**
 * Resolve `ROULETTE_BETTING_DURATION` from env, interpreting values < 1000 as
 * seconds (legacy handler used seconds for this one var, ms for the others).
 */
function resolveBettingDurationMs(): number {
  const raw = process.env.ROULETTE_BETTING_DURATION;
  if (!raw) return 15000;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return 15000;
  return n < 1000 ? n * 1000 : n;
}

const MAX_HISTORY = 100;

interface PlacedBet {
  id: string;
  userId: number;
  username: string;
  sessionId: number;
  type: RouletteBetType;
  value: string | number | null;
  amount: number;
  timestamp: Date;
}

interface ActivePlayer {
  id: number;
  username: string;
  avatar: string | null;
  joinedAt: number;
}

interface HistoryEntry {
  roundId: string | number | null;
  winningNumber: number;
  winningColor: 'red' | 'black' | 'green';
  timestamp: Date;
}

export class RouletteEngine extends RoundBasedEngine {
  readonly gameType: GameType = 'roulette';

  /** Players currently connected to the namespace. */
  private readonly activePlayers: Map<number, ActivePlayer> = new Map();
  /** Last 100 round outcomes. */
  private readonly history: HistoryEntry[] = [];
  /** All placed bets for the current round, indexed by userId. */
  private readonly currentBets: Map<number, PlacedBet[]> = new Map();
  /** Internal phase label exposed to the client. */
  private currentPhase: 'waiting' | 'betting' | 'spinning' | 'result' = 'waiting';
  /** Animation data for the in-flight spin (broadcast on `roulette:spin_started`). */
  private currentSpinAngles: ReturnType<typeof spinAngles> | null = null;
  /** Per-round config snapshot, refreshed at the top of each betting phase. */
  private currentConfig: any = null;
  /** Tick timers — kept on the instance so tests can stop the loop. */
  private countdownTimer: NodeJS.Timeout | null = null;
  private phaseTimer: NodeJS.Timeout | null = null;
  /** When true, `runCycle` exits after the current phase (used by tests). */
  private stopped = false;

  // ── Engine surface ──────────────────────────────────────────────────

  bettingDurationMs(): number {
    return resolveBettingDurationMs();
  }
  runningDurationMs(): number {
    return parseInt(process.env.ROULETTE_SPIN_DURATION || '10000', 10);
  }
  revealDurationMs(): number {
    return parseInt(process.env.ROULETTE_RESULT_DISPLAY || '5000', 10);
  }

  /**
   * Validate a raw `roulette:place_bet` payload.
   *
   * Returns `{ betAmount, choice }` where `choice` carries the type + value
   * for downstream evaluation. Throws with stable error codes that
   * `runExclusive` surfaces to the client.
   */
  protected betSchema(payload: any): { betAmount: number; choice: { type: RouletteBetType; value: string | number | null } } {
    const validated = validateSocketData(roulettePlaceBetSchema, payload);
    const { type, value, amount } = validated;

    if (!ALL_BET_TYPES.includes(type as RouletteBetType)) {
      throw new Error('invalid_bet_type');
    }
    const betType = type as RouletteBetType;

    // Type-specific value validation. Bets that take a value must have it in
    // range; valueless bets (RED/BLACK/ODD/EVEN/LOW/HIGH) ignore the field.
    switch (betType) {
      case 'STRAIGHT': {
        const n = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
        if (!Number.isFinite(n) || n < 0 || n > 36) throw new Error('invalid_straight_value');
        break;
      }
      case 'DOZEN':
      case 'COLUMN': {
        const d = typeof value === 'number' ? value : parseInt(String(value ?? ''), 10);
        if (![1, 2, 3].includes(d)) throw new Error('invalid_group_value');
        break;
      }
      case 'SPLIT':
      case 'STREET':
      case 'CORNER':
      case 'FIVE':
      case 'LINE': {
        if (typeof value !== 'string' || value.trim().length === 0) {
          throw new Error('invalid_combo_value');
        }
        break;
      }
      default:
        // RED/BLACK/ODD/EVEN/LOW/HIGH — no value required.
        break;
    }

    return {
      betAmount: amount,
      choice: { type: betType, value: (value ?? null) as string | number | null },
    };
  }

  /**
   * Draw the round, evaluate every bet, aggregate per-user payouts.
   *
   * A single user may have multiple bets in `bettors`; we still emit one
   * payout per `ActiveBet` (= one `gameSessions` row) so the base settles
   * each row individually. Aggregation of `roulette:personal_result` happens
   * in `processResults` so the broadcast still reflects the user's total.
   */
  protected async runRound(seed: SeedBundle, bettors: ReadonlyArray<ActiveBet>): Promise<RoundResolution> {
    const draw = drawRouletteSlot(seed);
    const payouts = this.evaluatePayouts(bettors, draw.number);
    return {
      payouts,
      publicResult: {
        winningNumber: draw.number,
        winningColor: draw.color,
        segmentIndex: draw.segmentIndex,
      },
    };
  }

  /**
   * Per-bet outcome list mapped from active bets — one entry per session row.
   * The override map is read from the current config snapshot (admin can
   * tune payouts at runtime).
   */
  private evaluatePayouts(bettors: ReadonlyArray<ActiveBet>, winningNumber: number): RoundResolution['payouts'] {
    const overrides = (this.currentConfig && this.currentConfig.payoutTable) || null;
    return bettors.map((bet) => {
      const choice = bet.choice as { type: RouletteBetType; value: string | number | null };
      const evalResult = evaluateBet(
        { type: choice.type, value: choice.value, amount: bet.betAmount },
        winningNumber,
        overrides,
      );
      return {
        userId: bet.userId,
        outcome: evalResult.winAmount, // 0 on loss; bet+payout on win
        multiplier: evalResult.isWinner ? (overrides?.[choice.type] ?? BET_TYPES[choice.type].payout) + 1 : 0,
        details: {
          type: choice.type,
          value: choice.value,
          isWinner: evalResult.isWinner,
          profit: evalResult.profit,
          sessionId: bet.sessionId,
        },
      };
    });
  }

  // ── Lifecycle overrides ──────────────────────────────────────────────

  override async onJoin(ctx: PlayerCtx): Promise<JoinPayload> {
    const joinPayload = await super.onJoin(ctx);
    const userId = ctx.user.userId;

    // Track active player. Roulette announces presence on join/leave.
    const player: ActivePlayer = {
      id: userId,
      username: ctx.user.username,
      avatar: null,
      joinedAt: Date.now(),
    };
    this.activePlayers.set(userId, player);

    // Initial snapshot — preserves the public `roulette:gameState` shape.
    ctx.emit('roulette:gameState', {
      phase: this.currentPhase,
      countdown: this.countdownRemainingSeconds(),
      roundId: this.round.id,
      history: this.history.slice(-10),
      currentBets: this.allBetsFlat(),
      activePlayers: Array.from(this.activePlayers.values()),
    });

    // Mid-spin joiners need the animation data so the wheel starts spinning
    // immediately on their client.
    if (this.currentPhase === 'spinning' && this.currentSpinAngles) {
      ctx.emit('roulette:spin_started', {
        roundId: this.round.id,
        timestamp: new Date(),
        spinData: this.currentSpinAngles,
      });
    }

    ctx.emit('roulette:activePlayers', Array.from(this.activePlayers.values()));
    // Broadcast to everyone except the joiner.
    for (const sub of this.subscribers) {
      if (sub.user.userId !== userId) {
        sub.emit('roulette:playerJoined', player);
      }
    }

    // Bind game-specific socket events (legacy compatibility shims).
    ctx.socket.on('roulette:join', (_data: any, callback?: (resp: any) => void) => {
      callback?.({ success: true, history: this.history.slice(-10) });
    });
    ctx.socket.on('roulette:place_bet', async (data: any, callback?: (resp: any) => void) => {
      try {
        const result = await this.placeBet(ctx, data);
        callback?.({ success: true, ...result });
      } catch (err: any) {
        const message = err instanceof Error ? err.message : String(err);
        callback?.({ success: false, error: this.formatClientError(message) });
      }
    });
    ctx.socket.on('roulette:spin', (_data: any, callback?: (resp: any) => void) => {
      callback?.({ success: true, message: 'Spin is automated in live mode' });
    });
    ctx.socket.on('roulette:get_history', (data: any, callback?: (resp: any) => void) => {
      const limit = data?.limit || 10;
      callback?.({ success: true, globalHistory: this.history.slice(-limit) });
    });

    return joinPayload;
  }

  override async onDisconnect(ctx: PlayerCtx): Promise<void> {
    await super.onDisconnect(ctx);
    const userId = ctx.user.userId;
    const player = this.activePlayers.get(userId);
    this.activePlayers.delete(userId);
    if (player) {
      for (const sub of this.subscribers) {
        sub.emit('roulette:playerLeft', { id: userId, username: player.username });
      }
    }
  }

  /**
   * Place a bet for the current round. Wraps the base `onBet` so we can also
   * track multiple-bets-per-user state, broadcast `roulette:playerBet`, and
   * emit `balanceUpdate` on success.
   */
  async placeBet(ctx: PlayerCtx, data: any): Promise<{ betId: string; balance: number; currentBets: PlacedBet[] }> {
    if (this.currentPhase !== 'betting') {
      throw new Error('Betting is closed');
    }

    const betResult: BetResult = await this.onBet(ctx, data);

    const choice = data as { type: RouletteBetType; value?: string | number | null };
    const placedBet: PlacedBet = {
      id: `${Date.now()}_${ctx.user.userId}`,
      userId: ctx.user.userId,
      username: ctx.user.username,
      sessionId: betResult.sessionId,
      type: choice.type,
      value: (choice.value ?? '') as string | number | null,
      amount: betResult.betAmount,
      timestamp: new Date(),
    };

    if (!this.currentBets.has(ctx.user.userId)) {
      this.currentBets.set(ctx.user.userId, []);
    }
    this.currentBets.get(ctx.user.userId)!.push(placedBet);

    ctx.emit('balanceUpdate', { balance: betResult.balance });
    for (const sub of this.subscribers) {
      sub.emit('roulette:playerBet', placedBet);
    }

    return {
      betId: placedBet.id,
      balance: betResult.balance,
      currentBets: this.currentBets.get(ctx.user.userId) ?? [],
    };
  }

  // ── Game loop ───────────────────────────────────────────────────────

  /**
   * Start the automated round loop. Idempotent — calling more than once is
   * a no-op. Tests can use `stop()` to halt the loop between assertions.
   */
  start(): void {
    if (this.currentPhase !== 'waiting') return;
    this.stopped = false;
    LoggingService.logGameEvent('roulette', 'service_initialized', { timestamp: new Date() });
    this.startBettingPhase();
  }

  /** Stop the loop. Used by tests to avoid runaway timers. */
  stop(): void {
    this.stopped = true;
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = null;
    }
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
  }

  private startBettingPhase(): void {
    if (this.stopped) return;

    // Refresh config snapshot for this round (admin may have changed payouts).
    GameConfigService.getConfig('roulette').then(
      (cfg) => { this.currentConfig = cfg; },
      () => { this.currentConfig = null; },
    );

    this.currentBets.clear();
    this.currentSpinAngles = null;
    this.openRound(); // mints seed bundle, broadcasts `gameState`
    this.currentPhase = 'betting';

    const totalSeconds = Math.ceil(this.bettingDurationMs() / 1000);

    for (const sub of this.subscribers) {
      sub.emit('bettingStart', { countdown: totalSeconds, roundId: this.round.id });
      sub.emit('countdown', { countdown: totalSeconds });
    }

    let remaining = totalSeconds;
    this.countdownTimer = setInterval(() => {
      remaining -= 1;
      for (const sub of this.subscribers) {
        sub.emit('countdown', { countdown: remaining });
      }
      if (remaining <= 0) {
        if (this.countdownTimer) {
          clearInterval(this.countdownTimer);
          this.countdownTimer = null;
        }
        this.startSpinPhase();
      }
    }, 1000);
  }

  private startSpinPhase(): void {
    if (this.stopped) return;
    this.currentPhase = 'spinning';
    this.lockBetting(); // base: transitions to running, broadcasts gameState

    for (const sub of this.subscribers) {
      sub.emit('bettingEnd', {});
    }

    // Pre-draw the slot so we know which segment to animate to. The actual
    // payout settlement still flows through `resolveRound` which redraws
    // from the same seed — both calls produce the same value because they
    // share the round's `serverSeed` + derived `clientSeed`.
    const seed: SeedBundle = {
      serverSeed: this.round.seed!.serverSeed,
      serverSeedHash: this.round.seed!.serverSeedHash,
      clientSeed: pf.deterministicClientSeed(this.round.id!, this.round.bets.map((b) => b.userId)),
      nonce: 0,
    };
    const draw = drawRouletteSlot(seed);
    this.currentSpinAngles = spinAngles(draw.segmentIndex, this.runningDurationMs());

    for (const sub of this.subscribers) {
      sub.emit('roulette:spin_started', {
        roundId: this.round.id,
        timestamp: new Date(),
        spinData: this.currentSpinAngles,
      });
    }

    LoggingService.logGameEvent('roulette', 'spin_started', { roundId: this.round.id });

    this.phaseTimer = setTimeout(() => {
      void this.processResults(draw.number, draw.color);
    }, this.runningDurationMs());
  }

  private async processResults(winningNumber: number, winningColor: 'red' | 'black' | 'green'): Promise<void> {
    if (this.stopped) return;
    this.currentPhase = 'result';

    // Snapshot bets/users BEFORE base settlement, since `resolveRound` will
    // clear/update them.
    const userBets = new Map<number, PlacedBet[]>();
    for (const [userId, bets] of this.currentBets) {
      userBets.set(userId, [...bets]);
    }

    // Run base settlement (settles every gameSessions row individually,
    // emits per-row `roundComplete` to each bettor).
    try {
      await this.resolveRound();
    } catch (err) {
      LoggingService.logSystemEvent('roulette_resolve_failed', {
        error: err instanceof Error ? err.message : String(err),
      }, 'error');
    }

    // Now emit the legacy per-user `roulette:personal_result` aggregate (sum
    // of all of that user's bets for the round). The base settles every row;
    // we just need to relay the totals to the client in the legacy shape.
    const overrides = (this.currentConfig && this.currentConfig.payoutTable) || null;
    for (const [userId, bets] of userBets) {
      const processedBets = bets.map((b) => {
        const evalResult = evaluateBet(
          { type: b.type, value: b.value, amount: b.amount },
          winningNumber,
          overrides,
        );
        return {
          ...b,
          isWinner: evalResult.isWinner,
          winAmount: evalResult.winAmount,
          profit: evalResult.profit,
        };
      });
      const totalWinnings = processedBets.reduce((s, b) => s + (b.winAmount || 0), 0);
      const totalProfit = processedBets.reduce((s, b) => s + b.profit, 0);

      const sub = this.findSubscriberByUserId(userId);
      if (sub) {
        // Refresh balance after base settlement (covers all sessions).
        try {
          const balance = await BalanceService.getBalance(userId);
          sub.emit('balanceUpdate', { balance });
        } catch {
          // ignore — balance reporting is best-effort
        }
        sub.emit('roulette:personal_result', {
          bets: processedBets,
          totalWinnings,
          totalProfit,
        });
      }
    }

    // Track round history
    const entry: HistoryEntry = {
      roundId: this.round.id,
      winningNumber,
      winningColor,
      timestamp: new Date(),
    };
    this.history.push(entry);
    if (this.history.length > MAX_HISTORY) {
      this.history.splice(0, this.history.length - MAX_HISTORY);
    }

    // Global result broadcast
    for (const sub of this.subscribers) {
      sub.emit('roulette:spin_result', {
        phase: 'result',
        gameId: this.round.id,
        winningNumber,
        winningColor,
        timestamp: new Date(),
      });
    }

    LoggingService.logGameEvent('roulette', 'spin_result', {
      roundId: this.round.id,
      winningNumber,
      winningColor,
    });

    // Show results, then loop into the next round
    this.phaseTimer = setTimeout(() => {
      for (const sub of this.subscribers) {
        sub.emit('roulette:round_complete', { message: 'Ready for new bets', timestamp: new Date() });
      }
      this.startBettingPhase();
    }, this.revealDurationMs());
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private allBetsFlat(): PlacedBet[] {
    const all: PlacedBet[] = [];
    for (const bets of this.currentBets.values()) {
      all.push(...bets);
    }
    return all;
  }

  private countdownRemainingSeconds(): number {
    if (this.currentPhase !== 'betting' || !this.round.endsAt) return 0;
    return Math.max(0, Math.ceil((this.round.endsAt - Date.now()) / 1000));
  }

  private findSubscriberByUserId(userId: number): PlayerCtx | null {
    for (const sub of this.subscribers) {
      if (sub.user.userId === userId) return sub;
    }
    return null;
  }

  /** Map internal error codes to legacy client-facing messages where needed. */
  private formatClientError(code: string): string {
    switch (code) {
      case 'not_betting_phase':
      case 'Betting is closed':
        return 'Betting is closed';
      case 'game_disabled':
        return 'Game is currently disabled';
      case 'bet_too_large':
        return 'Bet exceeds maximum';
      case 'invalid_bet':
        return 'Invalid bet';
      case 'invalid_bet_type':
        return 'Invalid bet type';
      case 'invalid_straight_value':
        return 'Invalid straight bet (must be 0-36)';
      case 'invalid_group_value':
        return 'Invalid dozen/column value (must be 1, 2, or 3)';
      case 'invalid_combo_value':
        return 'Invalid combination bet value';
      default:
        if (code.startsWith('limit_')) return `Bet blocked: ${code.slice(6)}`;
        return code;
    }
  }

  // Re-export helpers for tests
  /** Test-only: peek at the current phase. */
  __getPhase(): string {
    return this.currentPhase;
  }
  /** Test-only: peek at the in-memory bets map. */
  __getCurrentBets(): Map<number, PlacedBet[]> {
    return this.currentBets;
  }
  /** Test-only: peek at the history list. */
  __getHistory(): ReadonlyArray<HistoryEntry> {
    return this.history;
  }
}

// Convenience re-exports for callers that want to drive a winning number
// deterministically in tests.
export { drawFromNumber } from './rng.js';
