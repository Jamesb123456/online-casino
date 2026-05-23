/**
 * Wheel engine — round-based shared wheel where every bettor sees the same
 * winning segment but their payout differs by chosen difficulty.
 *
 * Phases: betting (with per-second `countdown`) → spinning (`wheelSpinning`) →
 * reveal (`wheel:game_result` + `wheel:personal_result` per bettor + final
 * `wheel:round_complete`). The legacy event names and payload shapes from
 * `socket/wheelHandler.ts` are preserved verbatim — note that two events
 * (`gameStarting`, `wheelSpinning`) have NO `wheel:` namespace prefix.
 *
 * The exported class is intentionally test-friendly: timers run via injected
 * scheduler hooks so unit tests can drive `runRound` directly without spinning
 * up the real interval/timeout loop. The handler/namespace wiring (task #17)
 * is responsible for invoking `start()` after construction.
 */
import { RoundBasedEngine, type ActiveBet, type RoundResolution } from '../_engine/rounds.js';
import { RingBuffer } from '../_engine/history.js';
import gameConfigService from '../../services/gameConfigService.js';
import LoggingService from '../../services/loggingService.js';
import type {
  BetResult,
  GameType,
  JoinPayload,
  PersistedSeeds,
  PlayerCtx,
  SeedBundle,
  WheelBetPayload,
} from '../_engine/types.js';
import pf from '../_engine/provablyFair.js';
import { drawSegment, spinAngles } from './rng.js';
import {
  DEFAULT_SEGMENT_PAYOUTS,
  resolveMultiplier,
  SEGMENT_COUNT,
  type WheelDifficulty,
} from './segments.js';

const VALID_DIFFICULTIES: ReadonlyArray<WheelDifficulty> = ['easy', 'medium', 'hard'];
const MAX_HISTORY = 100;

/**
 * Map a payout multiplier to a colour hint for `wheel:game_result`.
 * Mirrors the legacy palette used by `socket/wheelHandler.ts` so observer
 * clients without their own bet see a meaningful segment colour.
 */
function colorForMultiplier(multiplier: number): string {
  if (multiplier <= 0) return '#374151';
  if (multiplier < 0.3) return '#e74c3c';
  if (multiplier < 0.5) return '#e67e22';
  if (multiplier < 1.0) return '#f1c40f';
  if (multiplier < 1.2) return '#3498db';
  if (multiplier < 3.0) return '#2ecc71';
  return '#9b59b6';
}

/** History entry retained for the `wheel:gameState` snapshot on join. */
interface WheelHistoryEntry {
  roundId: string | number | null;
  segmentIndex: number;
  timestamp: Date;
}

/** Active-player record broadcast in `wheel:activePlayers` / `wheel:playerJoined`. */
interface ActivePlayer {
  id: number;
  username: string;
  avatar: string | null;
  joinedAt: number;
}

export class WheelEngine extends RoundBasedEngine {
  readonly gameType: GameType = 'wheel';

  /** Per-userId presence record. */
  protected readonly activePlayers: Map<number, ActivePlayer> = new Map();

  /** Most-recent rounds (latest-last), capped at MAX_HISTORY. */
  protected readonly history: RingBuffer<WheelHistoryEntry> = new RingBuffer<WheelHistoryEntry>(MAX_HISTORY);

  /** Cached config snapshot refreshed each betting phase. */
  protected currentPayoutTable: Record<string, number[]> | null = null;

  /** Spin/animation outcome captured between `runRound` and reveal broadcasts. */
  protected lastSpin: { segmentIndex: number; targetAngle: number } | null = null;

  // ── Phase durations (env-overridable) ─────────────────────────────────

  bettingDurationMs(): number {
    // Legacy env was specified in seconds — keep that behaviour but multiply
    // to ms for the base class.
    const raw = process.env.WHEEL_BETTING_DURATION;
    const seconds = raw != null ? parseInt(raw, 10) : 10;
    const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 10;
    return safe * 1000;
  }

  runningDurationMs(): number {
    const raw = process.env.WHEEL_SPIN_DURATION;
    const ms = raw != null ? parseInt(raw, 10) : 5000;
    return Number.isFinite(ms) && ms > 0 ? ms : 5000;
  }

  revealDurationMs(): number {
    const raw = process.env.WHEEL_RESULT_DISPLAY;
    const ms = raw != null ? parseInt(raw, 10) : 4000;
    return Number.isFinite(ms) && ms > 0 ? ms : 4000;
  }

  // ── Validation ────────────────────────────────────────────────────────

  protected betSchema(payload: WheelBetPayload): { betAmount: number; choice: { difficulty: WheelDifficulty } } {
    if (!payload || typeof payload !== 'object') {
      throw new Error('invalid_payload');
    }
    const betAmount = Number(payload.betAmount);
    if (!Number.isFinite(betAmount) || betAmount <= 0) {
      throw new Error('invalid_bet');
    }
    const difficulty = (payload.difficulty ?? 'medium') as WheelDifficulty;
    if (!VALID_DIFFICULTIES.includes(difficulty)) {
      throw new Error('invalid_difficulty');
    }
    return { betAmount, choice: { difficulty } };
  }

  // ── Lifecycle hooks ──────────────────────────────────────────────────

  override async onJoin(ctx: PlayerCtx): Promise<JoinPayload> {
    this.subscribers.add(ctx);
    const userId = ctx.user.userId;
    this.activePlayers.set(userId, {
      id: userId,
      username: ctx.user.username,
      avatar: null,
      joinedAt: Date.now(),
    });

    // Full-state snapshot for the joining client.
    ctx.emit('wheel:gameState', {
      phase: this.round.phase,
      countdown: this.currentCountdown(),
      roundId: this.round.id,
      segmentsByDifficulty: this.payoutTableForBroadcast(),
      history: this.history.slice(-10),
      currentBets: this.currentBetsFlat(),
      activePlayers: Array.from(this.activePlayers.values()),
    });

    if (this.round.phase === 'running' && this.lastSpin) {
      ctx.emit('wheelSpinning', {
        roundId: this.round.id,
        targetAngle: this.lastSpin.targetAngle,
        segmentIndex: this.lastSpin.segmentIndex,
      });
    }

    ctx.emit('wheel:activePlayers', Array.from(this.activePlayers.values()));
    // Broadcast presence to other clients in the namespace.
    for (const sub of this.subscribers) {
      if (sub === ctx) continue;
      sub.emit('wheel:playerJoined', {
        id: userId,
        username: ctx.user.username,
        avatar: null,
        joinedAt: Date.now(),
      });
    }

    return {
      serverSeedHash: this.round.seed?.serverSeedHash,
      state: {
        phase: this.round.phase,
        roundId: this.round.id,
      },
    };
  }

  override async onDisconnect(ctx: PlayerCtx): Promise<void> {
    this.subscribers.delete(ctx);
    const userId = ctx.user.userId;
    this.activePlayers.delete(userId);

    // If this user had an in-flight bet for the current round, leave the
    // session row alone — it was already debited and will be settled at
    // resolve via the cached socket reference on the ActiveBet. The base
    // class never looks at `activePlayers`, so removing here is safe.

    for (const sub of this.subscribers) {
      sub.emit('wheel:playerLeft', { id: userId, username: ctx.user.username });
    }
  }

  override async onBet(ctx: PlayerCtx, payload: WheelBetPayload): Promise<BetResult> {
    return this.runExclusive(ctx.user.userId, async () => {
      if (this.round.phase !== 'betting') {
        throw new Error('not_betting_phase');
      }
      // One bet per user per round.
      if (this.round.bets.some((b) => b.userId === ctx.user.userId)) {
        throw new Error('already_placed_bet');
      }

      const { betAmount, choice } = this.betSchema(payload);
      await this.assertCanBet(ctx.user.userId, betAmount);

      const bundle: SeedBundle = {
        serverSeed: this.round.seed!.serverSeed,
        serverSeedHash: this.round.seed!.serverSeedHash,
        clientSeed: pf.deterministicClientSeed(this.round.id!, [ctx.user.userId]),
        nonce: 0,
      };
      const persisted: PersistedSeeds = pf.toPersisted(bundle, { reveal: false, roundId: this.round.id });

      const { sessionId, balance } = await this.startSession(ctx.user.userId, betAmount, persisted, {
        choice,
        phase: 'betting',
      });

      const bet: ActiveBet = {
        userId: ctx.user.userId,
        username: ctx.user.username,
        sessionId,
        betAmount,
        choice,
        cashedOut: false,
        socket: ctx.socket,
      };
      this.round.bets.push(bet);

      // Personal balance refresh.
      ctx.emit('balanceUpdate', { balance });

      // Broadcast to the namespace so other players see the bet feed.
      const betInfo = {
        userId: ctx.user.userId,
        username: ctx.user.username,
        amount: betAmount,
        difficulty: choice.difficulty,
        timestamp: new Date(),
      };
      for (const sub of this.subscribers) {
        sub.emit('wheel:playerBet', betInfo);
      }

      return {
        sessionId,
        betAmount,
        balance,
        outcome: 0,
        completed: false,
        seeds: persisted,
      };
    });
  }

  // ── Round resolution ─────────────────────────────────────────────────

  protected async runRound(
    seed: SeedBundle,
    bettors: ReadonlyArray<ActiveBet>,
  ): Promise<RoundResolution> {
    const { segmentIndex } = drawSegment(seed);
    const { targetAngle } = spinAngles(segmentIndex);
    this.lastSpin = { segmentIndex, targetAngle };

    const payouts: RoundResolution['payouts'] = [];
    for (const bet of bettors) {
      const difficulty: WheelDifficulty = (bet.choice?.difficulty as WheelDifficulty) || 'medium';
      const multiplier = resolveMultiplier(difficulty, segmentIndex, this.currentPayoutTable);
      const winAmount = bet.betAmount * multiplier;
      payouts.push({
        userId: bet.userId,
        outcome: winAmount,
        multiplier,
        details: { difficulty, segmentIndex },
      });
    }

    return { payouts, publicResult: { segmentIndex, targetAngle } };
  }

  // ── Driving the game loop ────────────────────────────────────────────
  //
  // The base class's helpers (`openRound`, `lockBetting`, `resolveRound`)
  // own the seed lifecycle and per-bettor session settlement, but the
  // base broadcasts use generic `gameState` payloads. Wheel has its own
  // legacy event names, so we drive the timing manually here and emit the
  // wheel-specific events directly.
  //
  // Tests call `runRound` (above) in isolation; the loop below is only
  // exercised by the integration test and the namespace wiring.

  /** Begin the game loop. Call once after construction. */
  start(): void {
    if (this._started) return;
    this._started = true;
    this.startBettingPhase();
  }

  /** Stop any pending timers (used by namespace teardown / tests). */
  stop(): void {
    this._started = false;
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = null;
    }
    if (this._phaseTimer) {
      clearTimeout(this._phaseTimer);
      this._phaseTimer = null;
    }
  }

  private _started = false;
  private _countdownTimer: ReturnType<typeof setInterval> | null = null;
  private _phaseTimer: ReturnType<typeof setTimeout> | null = null;
  private _countdownSeconds = 0;

  private currentCountdown(): number {
    return this._countdownSeconds;
  }

  private payoutTableForBroadcast(): Record<string, any> {
    // Client expects `segmentsByDifficulty` shaped like the legacy table.
    // We send the raw multiplier arrays (the legacy format included colour
    // metadata, but the client only reads `.multiplier` for payout maths and
    // re-uses its own colour palette).
    const overrides = this.currentPayoutTable;
    const out: Record<string, any> = {};
    for (const diff of VALID_DIFFICULTIES) {
      const arr = (overrides && Array.isArray(overrides[diff]) ? overrides[diff] : DEFAULT_SEGMENT_PAYOUTS[diff]).slice(0, SEGMENT_COUNT);
      out[diff] = arr.map((m) => ({ multiplier: m }));
    }
    return out;
  }

  private currentBetsFlat(): Array<{ userId: number; username: string; amount: number; difficulty: string; timestamp: Date }> {
    return this.round.bets.map((b) => ({
      userId: b.userId,
      username: b.username,
      amount: b.betAmount,
      difficulty: (b.choice?.difficulty as string) || 'medium',
      timestamp: new Date(),
    }));
  }

  private startBettingPhase(): void {
    // Refresh config in the background.
    gameConfigService.getConfig('wheel').then(
      (cfg: any) => {
        this.currentPayoutTable =
          cfg && cfg.payoutTable && typeof cfg.payoutTable === 'object' ? cfg.payoutTable : null;
      },
      () => {
        this.currentPayoutTable = null;
      },
    );

    this.openRound();
    this.lastSpin = null;
    const seconds = Math.max(1, Math.floor(this.bettingDurationMs() / 1000));
    this._countdownSeconds = seconds;

    for (const sub of this.subscribers) {
      sub.emit('gameStarting', { countdown: seconds, roundId: this.round.id });
      sub.emit('countdown', { countdown: this._countdownSeconds });
    }

    this._countdownTimer = setInterval(() => {
      this._countdownSeconds = Math.max(0, this._countdownSeconds - 1);
      for (const sub of this.subscribers) {
        sub.emit('countdown', { countdown: this._countdownSeconds });
      }
      if (this._countdownSeconds <= 0) {
        if (this._countdownTimer) {
          clearInterval(this._countdownTimer);
          this._countdownTimer = null;
        }
        this.startSpinPhase();
      }
    }, 1000);
  }

  private startSpinPhase(): void {
    this.lockBetting();

    const seed: SeedBundle = {
      serverSeed: this.round.seed!.serverSeed,
      serverSeedHash: this.round.seed!.serverSeedHash,
      clientSeed: pf.deterministicClientSeed(this.round.id!, this.round.bets.map((b) => b.userId)),
      nonce: 0,
    };
    const { segmentIndex } = drawSegment(seed);
    const { targetAngle } = spinAngles(segmentIndex);
    this.lastSpin = { segmentIndex, targetAngle };

    for (const sub of this.subscribers) {
      sub.emit('wheelSpinning', {
        roundId: this.round.id,
        targetAngle,
        segmentIndex,
      });
    }

    LoggingService.logGameEvent('wheel', 'spin_started', { roundId: this.round.id });

    this._phaseTimer = setTimeout(() => {
      this.processResults(segmentIndex, seed).catch((err) => {
        LoggingService.logGameEvent('wheel', 'error_processing_results', {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, this.runningDurationMs());
  }

  private async processResults(segmentIndex: number, seed: SeedBundle): Promise<void> {
    // Settle each bet — payout, balance broadcast, personal_result event.
    for (const bet of this.round.bets) {
      const difficulty: WheelDifficulty = (bet.choice?.difficulty as WheelDifficulty) || 'medium';
      const multiplier = resolveMultiplier(difficulty, segmentIndex, this.currentPayoutTable);
      const winAmount = bet.betAmount * multiplier;
      const profit = winAmount - bet.betAmount;

      const persisted: PersistedSeeds = pf.toPersisted(
        { ...seed, clientSeed: pf.deterministicClientSeed(this.round.id!, [bet.userId]) },
        { reveal: true, roundId: this.round.id },
      );

      try {
        const balance = await this.endSession(bet.userId, bet.sessionId, bet.betAmount, {
          outcome: winAmount,
          finalMultiplier: multiplier,
          resultDetails: { difficulty, segmentIndex },
          seeds: persisted,
          completed: true,
        });
        bet.socket.emit('balanceUpdate', { balance });
        bet.socket.emit('wheel:personal_result', {
          betAmount: bet.betAmount,
          multiplier,
          winAmount,
          profit,
          difficulty,
        });
      } catch (err) {
        LoggingService.logGameEvent('wheel', 'error_settling_bet', {
          userId: bet.userId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Push to history.
    this.history.push({
      roundId: this.round.id,
      segmentIndex,
      timestamp: new Date(),
    });

    // Include a default-difficulty (medium) multiplier and a color hint so
    // observer clients without an active bet still receive a meaningful
    // payout indication — matches the legacy `wheel:game_result` contract.
    const defaultMultiplier = resolveMultiplier(
      'medium',
      segmentIndex,
      this.currentPayoutTable as Record<string, number[]> | null,
    );
    const defaultColor = colorForMultiplier(defaultMultiplier);

    for (const sub of this.subscribers) {
      sub.emit('wheel:game_result', {
        roundId: this.round.id,
        segmentIndex,
        multiplier: defaultMultiplier,
        color: defaultColor,
        timestamp: new Date(),
      });
    }

    LoggingService.logGameEvent('wheel', 'spin_result', {
      roundId: this.round.id,
      segmentIndex,
    });

    this._phaseTimer = setTimeout(() => {
      for (const sub of this.subscribers) {
        sub.emit('wheel:round_complete', { message: 'Ready for new bets', timestamp: new Date() });
      }
      this.startBettingPhase();
    }, this.revealDurationMs());
  }
}

export default WheelEngine;
