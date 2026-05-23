/**
 * Crash engine on top of `RoundBasedEngine`.
 *
 * Preserves the legacy Socket.IO contract from `server/src/socket/crashHandler.ts`
 * end-to-end:
 *
 *   inbound:  placeBet { amount, autoCashoutAt? }, cashOut {}
 *   outbound: gameState, gameHistory, currentBets, activePlayers,
 *             playerJoined, gameStarting, gameStarted, multiplierUpdate,
 *             playerBet, playerCashout, gameCrashed, betLost, balanceUpdate,
 *             autoCashoutSuccess, playerLeft
 *
 * The base engine handles:
 *   - per-user lock (`runExclusive`) so concurrent placeBet/cashOut for the
 *     same user are serialised
 *   - `gameSessions` row per bet (admin analytics depended on this)
 *   - balance debit/credit through `BalanceService` (decimal-safe, tx-safe)
 *   - provably-fair seed material (hash up-front, reveal at settle)
 *
 * We deviate from the base in a few targeted ways:
 *
 *   - `runningDurationMs()` is effectively unbounded — the running phase ends
 *     when the multiplier hits the crash point, not on a timer. We drive the
 *     state machine ourselves from a 100ms tick.
 *   - `onBet`/`cashOut` use socket ack callbacks (legacy contract) so we don't
 *     reuse the base's `betPlaced` emission. Bets are still recorded as
 *     `gameSessions` rows via `startSession`.
 *   - We emit the legacy `gameState`/`gameHistory`/`currentBets`/`activePlayers`
 *     on join, then push `gameStarting`/`gameStarted`/`multiplierUpdate`/
 *     `gameCrashed` to drive the client UI.
 */

import { RoundBasedEngine, type ActiveBet, type RoundResolution } from '../_engine/rounds.js';
import { RingBuffer } from '../_engine/history.js';
import pf from '../_engine/provablyFair.js';
import gameConfigService from '../../services/gameConfigService.js';
import balanceService from '../../services/balanceService.js';
import LoggingService from '../../services/loggingService.js';
import { validateSocketData, crashPlaceBetSchema } from '../../validation/schemas.js';
import { db } from '../../../drizzle/db.js';
import { gameSessions } from '../../../drizzle/schema.js';
import { eq } from 'drizzle-orm';
import { multiplierAt, drawCrashPoint, MAX_MULTIPLIER } from './rng.js';
import type {
  CrashActiveBet,
  CrashActivePlayer,
  CrashGameStateSnapshot,
  CrashHistoryEntry,
} from './types.js';
import type {
  ActionResult,
  BetResult,
  CrashBetPayload,
  JoinPayload,
  PersistedSeeds,
  PlayerCtx,
  SeedBundle,
} from '../_engine/types.js';

const TICK_MS = 100;
const HISTORY_LIMIT = 50;

export class CrashEngine extends RoundBasedEngine {
  readonly gameType = 'crash' as const;

  // ── Legacy contract state ────────────────────────────────────────────

  /** Public-facing game flags maintained for the legacy `gameState` snapshot. */
  private isGameStarting = false;
  private isGameRunning = false;
  /** Last broadcast multiplier (mirrors legacy `gameState.currentMultiplier`). */
  private currentMultiplier = 1;
  /** Absolute ms timestamp at which the fly phase started (drives the curve). */
  private runStartedAt = 0;
  /** Absolute ms timestamp at which the upcoming game will start (countdown end). */
  private startTime: number | null = null;
  /** Stable id used in legacy `gameStarting`/`gameStarted`/`gameCrashed` events. */
  private legacyGameId: string | null = null;
  /** Drawn crash point for the current round; null until round opens. */
  private currentCrashPoint: number | null = null;
  /** House edge snapshot for the current round (refreshed from config at openRound). */
  private currentHouseEdge = 0.04;

  /** Tick interval handle. */
  private tickInterval: NodeJS.Timeout | null = null;
  /** Cycle timeouts so we can clear them on shutdown / test teardown. */
  private cycleTimeouts: Set<NodeJS.Timeout> = new Set();
  /** Whether a cycle is already running — guards startCycle re-entry. */
  private started = false;

  /** Recent crash points, newest at the end. */
  private history: RingBuffer<CrashHistoryEntry> = new RingBuffer<CrashHistoryEntry>(HISTORY_LIMIT);
  /** Active players keyed by userId — drives `activePlayers`/`playerJoined`/`playerLeft`. */
  private activePlayers: Map<number, CrashActivePlayer> = new Map();
  /** Map userId -> socket so we can target per-user emits. */
  private userSockets: Map<number, PlayerCtx> = new Map();

  // ── RoundBasedEngine hooks ──────────────────────────────────────────

  bettingDurationMs(): number {
    return Number(process.env.CRASH_COUNTDOWN_MS) || 5000;
  }

  /**
   * The running phase isn't time-bounded — it ends when the multiplier hits
   * the crash point. Return a very large number so the base's timer-based
   * code paths (if ever invoked) never trigger.
   */
  runningDurationMs(): number {
    return Number.MAX_SAFE_INTEGER;
  }

  revealDurationMs(): number {
    return Number(process.env.CRASH_NEXT_GAME_MS) || 3000;
  }

  betSchema(payload: CrashBetPayload): { betAmount: number; choice: any } {
    // Reuse the same Zod schema the legacy handler used — keeps the contract
    // pixel-identical (min 0.10, max 5000, optional autoCashoutAt 1.01..50).
    const validated = validateSocketData(crashPlaceBetSchema, payload);
    return {
      betAmount: validated.amount,
      choice: { autoCashoutAt: validated.autoCashoutAt },
    };
  }

  /**
   * Resolve the round given the drawn crash point + per-bettor cashout state.
   *
   * Outcome semantics:
   *   - **cashed out before crash** → outcome = `bet.amount * cashedOutAt`
   *     (the player won that many credits)
   *   - **not cashed out** → outcome = 0 (lost the bet)
   *
   * NOTE: we override `resolveRound` to avoid double-crediting cashed-out
   * bets (we already credited them at cashout time). The payouts returned
   * here are the conceptual ones used by tests; the actual balance
   * movement is handled by the override.
   */
  protected async runRound(seed: SeedBundle, bettors: ReadonlyArray<ActiveBet>): Promise<RoundResolution> {
    const crashPoint =
      this.currentCrashPoint != null ? this.currentCrashPoint : drawCrashPoint(seed, this.currentHouseEdge);

    const payouts = bettors.map((b) => {
      const bet = b as CrashActiveBet;
      if (bet.cashedOut && bet.cashedOutAt != null) {
        const winAmount = bet.betAmount * bet.cashedOutAt;
        return {
          userId: bet.userId,
          outcome: winAmount,
          multiplier: bet.cashedOutAt,
          details: { crashPoint, cashedOutAt: bet.cashedOutAt, profit: bet.profit },
        };
      }
      return {
        userId: bet.userId,
        outcome: 0,
        multiplier: crashPoint,
        details: { crashPoint, cashedOut: false },
      };
    });

    return {
      payouts,
      publicResult: { crashPoint },
    };
  }

  /**
   * Override the base resolveRound so we don't double-credit cashed-out
   * bets. The base would call `endSession(..., outcome > 0)` which routes
   * through `balanceService.recordWin` again — but cashouts already
   * credited the player at click-time. We:
   *
   *   - settle the `gameSessions` row directly for cashed-out bets (no
   *     second balance call)
   *   - call `endSession` with outcome=0 for lost bets (no credit; closes
   *     the row + records seeds)
   *   - emit the same `roundComplete` payload the base would have so the
   *     contract is preserved for any subscribers.
   */
  protected override async resolveRound(): Promise<void> {
    if (this.round.phase !== 'running') return;
    const seedShared: SeedBundle = {
      serverSeed: this.round.seed!.serverSeed,
      serverSeedHash: this.round.seed!.serverSeedHash,
      clientSeed: pf.deterministicClientSeed(
        this.round.id!,
        this.round.bets.map((b) => b.userId),
      ),
      nonce: 0,
    };

    let resolution: RoundResolution;
    try {
      resolution = await this.runRound(seedShared, this.round.bets);
    } catch (err) {
      LoggingService.logSystemEvent('round_resolve_failed', {
        gameType: this.gameType,
        error: err instanceof Error ? err.message : String(err),
      }, 'error');
      this.round.phase = 'idle';
      return;
    }
    this.round.phase = 'resolved';

    for (const payout of resolution.payouts) {
      const bet = this.round.bets.find((b) => b.userId === payout.userId) as CrashActiveBet | undefined;
      if (!bet) continue;

      const perBetSeed: SeedBundle = {
        ...seedShared,
        clientSeed: pf.deterministicClientSeed(this.round.id!, [bet.userId]),
      };
      const persisted: PersistedSeeds = pf.toPersisted(perBetSeed, { reveal: true, roundId: this.round.id });

      try {
        if (bet.cashedOut) {
          // Already credited at cashout — just close out the session row.
          await db
            .update(gameSessions)
            .set({
              outcome: String(payout.outcome),
              finalMultiplier: payout.multiplier != null ? String(payout.multiplier) : null,
              gameState: { seeds: persisted } as any,
              resultDetails: (payout.details ?? null) as any,
              isCompleted: true,
              endTime: new Date(),
            })
            .where(eq(gameSessions.id, bet.sessionId));
        } else {
          // Lost bet — use the base helper (outcome=0 path doesn't credit).
          await this.endSession(bet.userId, bet.sessionId, bet.betAmount, {
            outcome: 0,
            finalMultiplier: payout.multiplier,
            resultDetails: payout.details ?? null,
            seeds: persisted,
            completed: true,
          });
        }
      } catch (err) {
        LoggingService.logSystemEvent('round_settle_failed', {
          gameType: this.gameType,
          userId: bet.userId,
          error: err instanceof Error ? err.message : String(err),
        }, 'error');
      }
    }

    // Public reveal broadcast (matches what the base would have sent).
    this.broadcast('gameState', {
      phase: 'reveal',
      roundId: this.round.id,
      result: resolution.publicResult,
      serverSeed: seedShared.serverSeed,
      serverSeedHash: seedShared.serverSeedHash,
    });
  }

  // ── Connection lifecycle ────────────────────────────────────────────

  override async onJoin(ctx: PlayerCtx): Promise<JoinPayload> {
    // Track subscribers via the base class.
    await super.onJoin(ctx);

    const userId = ctx.user.userId;
    this.userSockets.set(userId, ctx);

    const player: CrashActivePlayer = {
      id: userId,
      username: ctx.user.username,
      avatar: null,
      joinedAt: Date.now(),
    };
    this.activePlayers.set(userId, player);

    // Send the legacy snapshot bundle on join.
    ctx.emit('gameState', this.snapshotGameState());
    ctx.emit('gameHistory', this.history.slice(-10));
    ctx.emit('currentBets', this.snapshotCurrentBets());
    ctx.emit('activePlayers', Array.from(this.activePlayers.values()));

    // Tell everyone else this player joined (matches legacy
    // `socket.broadcast.emit('playerJoined', ...)`).
    for (const sub of this.subscribers) {
      if (sub === ctx) continue;
      sub.emit('playerJoined', { id: userId, username: ctx.user.username, avatar: null });
    }

    // Return a minimal join payload so `registerNamespace` doesn't double-up
    // on a `gameState` event with a conflicting shape.
    return {};
  }

  override async onDisconnect(ctx: PlayerCtx): Promise<void> {
    await super.onDisconnect(ctx);
    const userId = ctx.user.userId;
    const player = this.activePlayers.get(userId);
    this.activePlayers.delete(userId);
    this.userSockets.delete(userId);

    if (player) {
      // Broadcast to everyone still connected (the disconnecting socket is
      // already gone from `subscribers`).
      for (const sub of this.subscribers) {
        sub.emit('playerLeft', { id: userId, username: player.username });
      }
    }
  }

  // ── Bet / cashout handling (legacy ack contract) ───────────────────

  /**
   * Legacy placeBet contract: ack callback `{ success, error?, message? }`.
   * Wraps the base's startSession bookkeeping (gameSessions + balance debit)
   * inside `runExclusive` so concurrent bets from the same user serialise.
   */
  override async onBet(ctx: PlayerCtx, payload: CrashBetPayload): Promise<BetResult> {
    return this.runExclusive(ctx.user.userId, async () => {
      if (this.round.phase !== 'betting') {
        throw new Error('Cannot bet while game is running');
      }

      const userId = ctx.user.userId;
      // One bet per user per round (matches legacy duplicate check).
      if (this.round.bets.some((b) => b.userId === userId)) {
        throw new Error('You already have an active bet');
      }

      const { betAmount, choice } = this.betSchema(payload);
      await this.assertCanBet(userId, betAmount);

      const bundle: SeedBundle = {
        serverSeed: this.round.seed!.serverSeed,
        serverSeedHash: this.round.seed!.serverSeedHash,
        clientSeed: pf.deterministicClientSeed(this.round.id!, [userId]),
        nonce: 0,
      };
      const persisted: PersistedSeeds = pf.toPersisted(bundle, { reveal: false, roundId: this.round.id });

      const { sessionId, balance } = await this.startSession(userId, betAmount, persisted, {
        choice,
        phase: 'betting',
      });

      const autoCashoutAt: number | undefined = choice?.autoCashoutAt;
      const bet: CrashActiveBet = {
        userId,
        username: ctx.user.username,
        sessionId,
        betAmount,
        choice,
        cashedOut: false,
        cashedOutAt: null,
        profit: 0,
        autoCashoutAt,
        avatar: null,
        socket: ctx.socket,
      };
      this.round.bets.push(bet);

      // Per-player balance update so the UI deducts the bet immediately.
      ctx.emit('balanceUpdate', { balance });

      // Broadcast the bet to everyone in the namespace (legacy `playerBet`).
      const playerInfo = this.activePlayers.get(userId);
      for (const sub of this.subscribers) {
        sub.emit('playerBet', {
          userId,
          username: ctx.user.username,
          avatar: playerInfo?.avatar ?? null,
          amount: betAmount,
          autoCashoutAt,
        });
      }

      LoggingService.logBetPlaced('crash', this.legacyGameId, userId, betAmount, { autoCashoutAt });

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

  /**
   * Manual cashout. Mirrors legacy semantics:
   *   - rejects when game is not running
   *   - rejects when no active bet
   *   - rejects when already cashed out
   *   - credits `bet * currentMultiplier` via BalanceService
   *   - broadcasts `playerCashout` to the namespace
   *   - emits `balanceUpdate` to the bettor
   *
   * Returns the legacy ack shape via `details`. The `gameSessions` row is
   * settled here too so analytics gets the multiplier immediately rather
   * than waiting for the crash event.
   */
  async cashOut(ctx: PlayerCtx): Promise<ActionResult> {
    return this.runExclusive(ctx.user.userId, async () => {
      if (!this.isGameRunning) {
        throw new Error('Game is not running');
      }
      const userId = ctx.user.userId;
      const bet = this.round.bets.find((b) => b.userId === userId) as CrashActiveBet | undefined;
      if (!bet) {
        throw new Error('No active bet found');
      }
      if (bet.cashedOut) {
        throw new Error('Already cashed out');
      }

      const cashoutMultiplier = this.currentMultiplier;
      const winAmount = bet.betAmount * cashoutMultiplier;
      const profit = winAmount - bet.betAmount;

      bet.cashedOut = true;
      bet.cashedOutAt = cashoutMultiplier;
      bet.profit = profit;

      const balance = await this.creditAndSettle(bet, cashoutMultiplier, winAmount, { automatic: false });

      LoggingService.logBetResult('crash', this.legacyGameId, userId, bet.betAmount, winAmount, true, {
        multiplier: cashoutMultiplier,
        method: 'manual_cashout',
      });

      return {
        sessionId: bet.sessionId,
        balance,
        outcome: winAmount,
        finalMultiplier: cashoutMultiplier,
        completed: true,
        resultDetails: { profit },
      };
    });
  }

  // ── Cycle / tick loop ───────────────────────────────────────────────

  /**
   * Kick off the perpetual round cycle. Idempotent — safe to call multiple
   * times; only the first call actually starts the loop.
   */
  startCycle(): void {
    if (this.started) return;
    this.started = true;
    this.beginRound();
  }

  /** Stop the cycle and clear all timers. Used by integration tests / shutdown. */
  stopCycle(): void {
    this.started = false;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    for (const t of this.cycleTimeouts) clearTimeout(t);
    this.cycleTimeouts.clear();
  }

  private beginRound(): void {
    if (!this.started) return;

    // Refresh config snapshot for THIS round (best-effort — falls back to last
    // known edge if the call fails).
    gameConfigService
      .getConfig('crash')
      .then((cfg) => {
        if (typeof cfg?.houseEdge === 'number') {
          this.currentHouseEdge = cfg.houseEdge;
        }
      })
      .catch(() => {
        /* keep previous edge */
      });

    // Open the round in the base class — sets seed material and broadcasts
    // the generic `gameState` event (with phase + seed hash).
    this.openRound();

    // Mirror the legacy state flags + ids.
    this.isGameStarting = true;
    this.isGameRunning = false;
    this.currentMultiplier = 1;
    this.legacyGameId = `game_${Date.now()}`;
    this.startTime = Date.now() + this.bettingDurationMs();
    this.currentCrashPoint = null;

    // Legacy `gameStarting` broadcast.
    const countdownSeconds = this.bettingDurationMs() / 1000;
    for (const sub of this.subscribers) {
      sub.emit('gameStarting', { gameId: this.legacyGameId, startingIn: countdownSeconds });
    }

    LoggingService.logGameStart('crash', this.legacyGameId, {
      houseEdge: this.currentHouseEdge,
      startTime: new Date(),
    });

    const t = setTimeout(() => {
      this.cycleTimeouts.delete(t);
      this.startFlyPhase();
    }, this.bettingDurationMs());
    this.cycleTimeouts.add(t);
  }

  private startFlyPhase(): void {
    if (!this.started) return;
    if (this.round.phase !== 'betting') return;

    // Draw the crash point now — needs the seed bundle from the base.
    const seed: SeedBundle = {
      serverSeed: this.round.seed!.serverSeed,
      serverSeedHash: this.round.seed!.serverSeedHash,
      clientSeed: pf.deterministicClientSeed(
        this.round.id!,
        this.round.bets.map((b) => b.userId),
      ),
      nonce: 0,
    };
    this.currentCrashPoint = drawCrashPoint(seed, this.currentHouseEdge);

    // Transition the base's round state machine.
    this.lockBetting();

    this.isGameStarting = false;
    this.isGameRunning = true;
    this.currentMultiplier = 1;
    this.runStartedAt = Date.now();

    for (const sub of this.subscribers) {
      sub.emit('gameStarted', { gameId: this.legacyGameId });
    }

    this.tickInterval = setInterval(() => {
      this.tick().catch((err) => {
        LoggingService.logSystemEvent('crash_tick_error', { error: String(err) }, 'error');
      });
    }, TICK_MS);
  }

  private async tick(): Promise<void> {
    if (!this.isGameRunning) return;

    const elapsed = Date.now() - this.runStartedAt;
    this.currentMultiplier = multiplierAt(elapsed);

    // Cap multiplier at 50x — force crash if reached.
    if (this.currentMultiplier >= MAX_MULTIPLIER) {
      this.currentMultiplier = MAX_MULTIPLIER;
      await this.crash();
      return;
    }

    // Process auto-cashouts BEFORE checking crash — a bet whose threshold is
    // crossed on the same tick as the crash point should still win (matches
    // legacy ordering).
    await this.processAutoCashouts();

    if (this.currentCrashPoint != null && this.currentMultiplier >= this.currentCrashPoint) {
      await this.crash();
      return;
    }

    for (const sub of this.subscribers) {
      sub.emit('multiplierUpdate', { multiplier: this.currentMultiplier });
    }
  }

  private async processAutoCashouts(): Promise<void> {
    for (const bet of this.round.bets as CrashActiveBet[]) {
      if (bet.cashedOut) continue;
      if (!bet.autoCashoutAt) continue;
      if (this.currentMultiplier < bet.autoCashoutAt) continue;

      const cashoutMultiplier = this.currentMultiplier;
      const winAmount = bet.betAmount * cashoutMultiplier;
      const profit = winAmount - bet.betAmount;

      bet.cashedOut = true;
      bet.cashedOutAt = cashoutMultiplier;
      bet.profit = profit;

      try {
        await this.creditAndSettle(bet, cashoutMultiplier, winAmount, { automatic: true });
      } catch (err) {
        LoggingService.logGameEvent('crash', 'error_auto_cashout', { error: String(err), userId: bet.userId });
        continue;
      }

      const userCtx = this.userSockets.get(bet.userId);
      if (userCtx) {
        userCtx.emit('autoCashoutSuccess', {
          multiplier: cashoutMultiplier,
          winAmount,
          profit,
        });
      }
    }
  }

  /**
   * Credit a successful cashout via BalanceService and finalise the
   * `gameSessions` row for this bet. Broadcasts `playerCashout` and emits
   * `balanceUpdate` to the bettor. Returns the post-credit balance.
   */
  private async creditAndSettle(
    bet: CrashActiveBet,
    cashoutMultiplier: number,
    winAmount: number,
    opts: { automatic: boolean },
  ): Promise<number> {
    let balance = 0;
    try {
      const credit = await balanceService.recordWin(bet.userId, bet.betAmount, winAmount, 'crash', {
        gameSessionId: bet.sessionId,
      });
      balance = Number((credit as any)?.user?.balance ?? 0);
    } catch (err) {
      LoggingService.logGameEvent('crash', 'error_recording_win', {
        error: String(err),
        userId: bet.userId,
      });
      throw err;
    }

    const userCtx = this.userSockets.get(bet.userId);
    if (userCtx) {
      userCtx.emit('balanceUpdate', { balance });
    }

    const playerInfo = this.activePlayers.get(bet.userId);
    for (const sub of this.subscribers) {
      sub.emit('playerCashout', {
        userId: bet.userId,
        username: bet.username,
        avatar: playerInfo?.avatar ?? null,
        multiplier: cashoutMultiplier,
        profit: bet.profit,
        amount: bet.betAmount,
        ...(opts.automatic ? { automatic: true } : {}),
      });
    }

    return balance;
  }

  private async crash(): Promise<void> {
    if (!this.isGameRunning) return;
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    this.isGameRunning = false;
    this.isGameStarting = false;

    // Resolve the round through the base class. This settles each session
    // row (incl. the loss rows with outcome=0).
    try {
      await this.resolveRound();
    } catch (err) {
      LoggingService.logSystemEvent('crash_resolve_failed', { error: String(err) }, 'error');
    }

    const crashPoint = this.currentCrashPoint ?? this.currentMultiplier;
    const entry: CrashHistoryEntry = {
      gameId: this.legacyGameId ?? `game_${Date.now()}`,
      crashPoint,
      timestamp: Date.now(),
    };
    this.history.push(entry);

    const nextSeconds = this.revealDurationMs() / 1000;
    for (const sub of this.subscribers) {
      sub.emit('gameCrashed', { crashPoint, nextGameIn: nextSeconds });
    }

    // Tell lost bettors explicitly (legacy `betLost`).
    for (const b of this.round.bets as CrashActiveBet[]) {
      if (b.cashedOut) continue;
      const userCtx = this.userSockets.get(b.userId);
      if (userCtx) {
        userCtx.emit('betLost', { amount: b.betAmount, gameId: this.legacyGameId });
      }
    }

    LoggingService.logGameEnd('crash', this.legacyGameId, {
      finalMultiplier: this.currentMultiplier,
      crashPoint,
    });

    // Schedule the next round after the reveal window.
    const t = setTimeout(() => {
      this.cycleTimeouts.delete(t);
      this.beginRound();
    }, this.revealDurationMs());
    this.cycleTimeouts.add(t);
  }

  // ── Snapshots ───────────────────────────────────────────────────────

  private snapshotGameState(): CrashGameStateSnapshot {
    return {
      isGameRunning: this.isGameRunning,
      isGameStarting: this.isGameStarting,
      currentMultiplier: this.currentMultiplier,
      timeUntilStart: this.startTime ? (this.startTime - Date.now()) / 1000 : null,
    };
  }

  private snapshotCurrentBets(): Array<{
    userId: number;
    username: string;
    avatar: string | null;
    amount: number;
    autoCashoutAt: number | undefined;
    cashedOut: boolean;
    cashedOutAt: number | null;
    profit: number;
  }> {
    return (this.round.bets as CrashActiveBet[]).map((b) => ({
      userId: b.userId,
      username: b.username,
      avatar: b.avatar,
      amount: b.betAmount,
      autoCashoutAt: b.autoCashoutAt,
      cashedOut: b.cashedOut,
      cashedOutAt: b.cashedOutAt,
      profit: b.profit,
    }));
  }

  // ── Test helpers (not part of public contract) ──────────────────────

  /** @internal — used by unit tests to drive the engine without timers. */
  __test: any = {
    setRound: (round: any) => {
      this.round = round;
    },
    getRound: () => this.round,
    setGameRunning: (v: boolean) => {
      this.isGameRunning = v;
    },
    setMultiplier: (m: number) => {
      this.currentMultiplier = m;
    },
    setCrashPoint: (p: number | null) => {
      this.currentCrashPoint = p;
    },
    setHouseEdge: (e: number) => {
      this.currentHouseEdge = e;
    },
    setRunStartedAt: (t: number) => {
      this.runStartedAt = t;
    },
    runRound: (seed: SeedBundle, bettors: ReadonlyArray<ActiveBet>) => this.runRound(seed, bettors),
    tick: () => this.tick(),
    processAutoCashouts: () => this.processAutoCashouts(),
  };
}

export default CrashEngine;
