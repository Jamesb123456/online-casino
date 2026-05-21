import { db } from '../../../drizzle/db.js';
import { gameSessions } from '../../../drizzle/schema.js';
import { eq } from 'drizzle-orm';
import balanceService from '../../services/balanceService.js';
import gameConfigService from '../../services/gameConfigService.js';
import userLimitsService from '../../services/userLimitsService.js';
import LoggingService from '../../services/loggingService.js';
import type {
  ActionResult,
  BetResult,
  GameType,
  JoinPayload,
  OutcomeReport,
  PersistedSeeds,
  PlayerCtx,
} from './types.js';

/**
 * Abstract base for every game engine.
 *
 * Subclasses implement the four business hooks (`onJoin`, `onBet`, `onAction`,
 * `onDisconnect`) and call the protected helpers (`startSession`, `endSession`,
 * `payout`, `runExclusive`, `assertCanBet`) for the boring infrastructure work
 * that used to be duplicated across eight handlers.
 *
 * Invariants the base enforces — subclasses cannot bypass them:
 *
 * 1. **All balance movement goes through `BalanceService`** (Decimal.js +
 *    transactional house hook + tournament/alert side-effects).
 * 2. **Every bet creates a `gameSessions` row** and updates it on settle.
 *    Admin analytics depends on this and was previously empty.
 * 3. **One in-flight action per user** via `runExclusive` — closes the
 *    rapid-double-bet race in Crash/Roulette/Wheel and the double-hit race
 *    in Blackjack.
 * 4. **Config + limits checks happen before any RNG draw.**
 */
export abstract class GameEngine {
  abstract readonly gameType: GameType;

  /** Promise chain per user id — serialises onBet/onAction for that user. */
  private readonly _userLocks: Map<number, Promise<unknown>> = new Map();

  // ── Subclass surface ────────────────────────────────────────────────

  /** Called once when a client connects to the namespace. */
  abstract onJoin(ctx: PlayerCtx): Promise<JoinPayload>;

  /**
   * Called when the client emits the bet event (round-based: `placeBet`;
   * instant: the game-specific bet event, e.g. `dice:roll`, `slots:spin`).
   * Subclasses do the RNG + payout calc and return an OutcomeReport.
   * The base wraps the call in `runExclusive` and owns the session/balance plumbing.
   */
  abstract onBet(ctx: PlayerCtx, payload: any): Promise<BetResult>;

  /**
   * Called for any non-bet game action (cashout, hit/stand, reveal, …).
   * `action` is the engine-specific identifier; payload is whatever the
   * client sent. Default no-op for games that never have actions (Dice/Slots).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onAction(_ctx: PlayerCtx, _action: string, _payload: any): Promise<ActionResult> {
    throw new Error(`onAction not supported by ${this.gameType}`);
  }

  /** Called when the socket disconnects. Subclasses release any per-user state. */
  abstract onDisconnect(ctx: PlayerCtx): Promise<void>;

  // ── Protected helpers used by subclasses ────────────────────────────

  /**
   * Serialise async calls per user. Returns the promise so the caller can
   * await. Subsequent calls for the same user queue behind the in-flight one.
   */
  protected async runExclusive<T>(userId: number, fn: () => Promise<T>): Promise<T> {
    const prior = this._userLocks.get(userId) || Promise.resolve();
    const next = prior.then(fn, fn);
    // Store the wrapped (swallow-errors) chain so a rejection in one call
    // doesn't permanently break the lock for that user.
    this._userLocks.set(userId, next.catch(() => undefined));
    try {
      return await next;
    } finally {
      // If this was the last queued call, drop the entry so the map doesn't
      // grow unbounded.
      if (this._userLocks.get(userId) === next.catch(() => undefined as any)) {
        this._userLocks.delete(userId);
      }
    }
  }

  /**
   * Pre-bet gate: config enabled + per-game max + per-user limits.
   * Returns `{ houseEdge, maxBet, payoutTable }` on success; throws an Error
   * with a `code:` prefix string on failure so handlers can map cleanly to
   * client error events.
   */
  protected async assertCanBet(userId: number, betAmount: number): Promise<{
    houseEdge: number;
    maxBet: number;
    payoutTable: any;
  }> {
    if (!Number.isFinite(betAmount) || betAmount <= 0) {
      throw new Error('invalid_bet');
    }
    const config = await gameConfigService.getConfig(this.gameType);
    if (!config.enabled) {
      throw new Error('game_disabled');
    }
    if (config.maxBet > 0 && betAmount > config.maxBet) {
      throw new Error('bet_too_large');
    }
    const limits = await userLimitsService.assertCanBet(userId, betAmount, this.gameType);
    if (!limits.ok) {
      throw new Error(`limit_${limits.reason}`);
    }
    return {
      houseEdge: config.houseEdge,
      maxBet: config.maxBet,
      payoutTable: config.payoutTable,
    };
  }

  /**
   * Open a new `gameSessions` row, debiting the bet via `BalanceService.placeBet`.
   * Returns the session id and the post-debit balance.
   *
   * `seeds` are written into `gameState` so the client (and replay tests) can
   * verify the round later. `serverSeed` is null at this point — it gets
   * filled in by `endSession`.
   */
  protected async startSession(
    userId: number,
    betAmount: number,
    seeds: PersistedSeeds,
    initialState: Record<string, any> = {},
  ): Promise<{ sessionId: number; balance: number }> {
    // 1. Open the session row first so the debit transaction can reference its id.
    const inserted = await db.insert(gameSessions).values({
      userId,
      gameType: this.gameType,
      initialBet: String(betAmount),
      totalBet: String(betAmount),
      outcome: '0',
      gameState: { seeds, ...initialState } as any,
      isCompleted: false,
    });

    // Drizzle MySQL returns `{insertId}` in the result header; tests mock this.
    const sessionId = Number((inserted as any)?.[0]?.insertId ?? (inserted as any)?.insertId ?? 0);
    if (!sessionId) {
      LoggingService.logSystemEvent('start_session_failed', { userId, gameType: this.gameType }, 'error');
      throw new Error('session_insert_failed');
    }

    // 2. Debit the bet — BalanceService records both the transaction and the
    //    house movement inside one DB transaction.
    const debit = await balanceService.placeBet(userId, betAmount, this.gameType, { gameSessionId: sessionId });
    const balance = Number((debit as any)?.user?.balance ?? 0);

    return { sessionId, balance };
  }

  /**
   * Settle a session: optionally pay out, mark `isCompleted = true`, attach
   * the revealed seeds + result details to the row. Returns the post-payout
   * balance.
   */
  protected async endSession(
    userId: number,
    sessionId: number,
    betAmount: number,
    report: OutcomeReport,
  ): Promise<number> {
    let balance: number | null = null;

    if (report.outcome > 0) {
      const credit = await balanceService.recordWin(userId, betAmount, report.outcome, this.gameType, {
        gameSessionId: sessionId,
      });
      balance = Number((credit as any)?.user?.balance ?? 0);
    }

    await db
      .update(gameSessions)
      .set({
        outcome: String(report.outcome),
        finalMultiplier: report.finalMultiplier != null ? String(report.finalMultiplier) : null,
        gameState: report.seeds ? ({ seeds: report.seeds } as any) : undefined,
        resultDetails: (report.resultDetails ?? null) as any,
        isCompleted: report.completed,
        endTime: report.completed ? new Date() : null,
      })
      .where(eq(gameSessions.id, sessionId));

    if (balance == null) {
      balance = await balanceService.getBalance(userId);
    }
    return balance;
  }

  /**
   * Append additional state to an in-progress session (e.g. Blackjack hit
   * adds a card, Landmines reveal flips a tile). Does not touch the balance
   * or `isCompleted`.
   */
  protected async updateSessionState(
    sessionId: number,
    statePatch: Record<string, any>,
  ): Promise<void> {
    // `gameState` is JSON — drizzle-mysql writes it whole. Caller is
    // responsible for passing the full new object (engines hold the current
    // state in memory anyway).
    await db
      .update(gameSessions)
      .set({ gameState: statePatch as any })
      .where(eq(gameSessions.id, sessionId));
  }
}

export type AnyGameEngine = GameEngine;
