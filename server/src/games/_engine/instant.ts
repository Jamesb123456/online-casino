import { GameEngine } from './base.js';
import pf from './provablyFair.js';
import LoggingService from '../../services/loggingService.js';
import type {
  ActionResult,
  BetResult,
  JoinPayload,
  PersistedSeeds,
  PlayerCtx,
  SeedBundle,
} from './types.js';

/**
 * Base class for instant-resolve games: Blackjack, Plinko, Landmines, Dice,
 * Slots. Each user gets their own session lifecycle; there is no shared
 * round loop.
 *
 * Two flavours of instant game share this base:
 *
 *   - **Single-shot**: `onBet` does the bet, RNG, payout, and closes the
 *     session in one call (Dice, Slots, Plinko single-ball).
 *
 *   - **Multi-step**: `onBet` opens the session and returns an intermediate
 *     state; subsequent `onAction(ctx, 'hit' | 'reveal' | 'cashout', ...)`
 *     calls advance the game until completion (Blackjack, Landmines).
 *
 * Subclasses store per-user state in `this.sessions` (keyed by userId). The
 * base provides:
 *
 *   - `nextSeedBundle(userId)` — rotating server seed + per-user client seed
 *     + auto-incrementing nonce.
 *   - `setClientSeed(userId, raw)` — handler for the optional `setClientSeed`
 *     socket event (rotates the active server seed and reveals the old one).
 *   - `onDisconnect` default that calls `onAbandon(state)` for each open
 *     session, so subclasses just decide whether to auto-resolve or void.
 */
export abstract class InstantResolveEngine<S extends InstantSession = InstantSession> extends GameEngine {
  /** Active sessions keyed by user id. Cleared on disconnect / completion. */
  protected readonly sessions: Map<number, S> = new Map();

  /** Per-user seed material; rotates when the user requests it or after `MAX_NONCES`. */
  protected readonly userSeeds: Map<number, UserSeedState> = new Map();

  /** How many draws before forcing a seed rotation. Override per game. */
  protected readonly rotateAfterDraws: number = 1000;

  // ── Subclass surface for multi-step games ──────────────────────────

  /** Called for each open session on disconnect. Default: log + drop. */
  protected async onAbandon(_userId: number, _session: S): Promise<void> {
    // Default: no-op. Multi-step games should override to auto-resolve
    // (e.g. Blackjack auto-stand) so rows don't dangle as isCompleted=false.
  }

  // ── Common lifecycle ───────────────────────────────────────────────

  async onJoin(ctx: PlayerCtx): Promise<JoinPayload> {
    const seeds = this.ensureSeeds(ctx.user.userId);
    return {
      serverSeedHash: seeds.serverSeedHash,
      state: {
        clientSeed: seeds.clientSeed,
        nextNonce: seeds.nextNonce,
        hasActiveSession: this.sessions.has(ctx.user.userId),
      },
    };
  }

  async onDisconnect(ctx: PlayerCtx): Promise<void> {
    const userId = ctx.user.userId;
    const session = this.sessions.get(userId);
    if (session) {
      try {
        await this.onAbandon(userId, session);
      } catch (err) {
        LoggingService.logSystemEvent('instant_abandon_failed', {
          gameType: this.gameType,
          userId,
          error: err instanceof Error ? err.message : String(err),
        }, 'warning');
      }
      this.sessions.delete(userId);
    }
    // Drop seed cache so a fresh connection gets a fresh pair.
    this.userSeeds.delete(userId);
  }

  // ── Seed management ────────────────────────────────────────────────

  /**
   * Ensure a user has a seed pair and return the current one. Mints on first
   * call. Use `nextSeedBundle` when actually drawing — this just exposes the
   * hash for the join handshake.
   */
  protected ensureSeeds(userId: number): UserSeedState {
    let state = this.userSeeds.get(userId);
    if (!state) {
      const { serverSeed, serverSeedHash } = pf.newServerSeed();
      state = {
        serverSeed,
        serverSeedHash,
        clientSeed: pf.normaliseClientSeed(undefined),
        nextNonce: 1,
      };
      this.userSeeds.set(userId, state);
    }
    return state;
  }

  /**
   * Produce the next seed bundle for a draw. Increments the nonce. After
   * `rotateAfterDraws` calls, auto-rotates and returns the revealed old
   * server seed via the optional callback so the engine can broadcast it.
   */
  protected nextSeedBundle(userId: number, onRotate?: (revealed: SeedBundle) => void): SeedBundle {
    const state = this.ensureSeeds(userId);
    if (state.nextNonce > this.rotateAfterDraws) {
      const revealed: SeedBundle = {
        serverSeed: state.serverSeed,
        serverSeedHash: state.serverSeedHash,
        clientSeed: state.clientSeed,
        nonce: state.nextNonce - 1,
      };
      const { serverSeed, serverSeedHash } = pf.newServerSeed();
      state.serverSeed = serverSeed;
      state.serverSeedHash = serverSeedHash;
      state.nextNonce = 1;
      if (onRotate) onRotate(revealed);
    }
    const bundle: SeedBundle = {
      serverSeed: state.serverSeed,
      serverSeedHash: state.serverSeedHash,
      clientSeed: state.clientSeed,
      nonce: state.nextNonce,
    };
    state.nextNonce += 1;
    return bundle;
  }

  /**
   * Handler for the optional `setClientSeed` socket event. Rotates the
   * server seed (and reveals the old one) so the new client seed only
   * affects future draws.
   */
  rotateForNewClientSeed(userId: number, rawClientSeed: unknown): {
    revealed: SeedBundle;
    next: { serverSeedHash: string; clientSeed: string };
  } {
    const state = this.ensureSeeds(userId);
    const revealed: SeedBundle = {
      serverSeed: state.serverSeed,
      serverSeedHash: state.serverSeedHash,
      clientSeed: state.clientSeed,
      nonce: state.nextNonce - 1,
    };
    const { serverSeed, serverSeedHash } = pf.newServerSeed();
    state.serverSeed = serverSeed;
    state.serverSeedHash = serverSeedHash;
    state.clientSeed = pf.normaliseClientSeed(rawClientSeed);
    state.nextNonce = 1;
    return {
      revealed,
      next: { serverSeedHash: state.serverSeedHash, clientSeed: state.clientSeed },
    };
  }

  // ── onBet/onAction stay abstract — see subclass hooks ──────────────

  abstract override onBet(ctx: PlayerCtx, payload: any): Promise<BetResult>;

  /**
   * Single-shot helper for the simplest instant games (Dice, Slots, single-ball Plinko).
   * Subclasses call this from `onBet` to do everything in one shot:
   *  1. lock per-user,
   *  2. validate config + limits,
   *  3. draw the seed bundle,
   *  4. open the session row,
   *  5. let the subclass compute the outcome,
   *  6. close the session with the result.
   */
  protected async oneShot(
    ctx: PlayerCtx,
    betAmount: number,
    compute: (input: {
      seed: SeedBundle;
      houseEdge: number;
      payoutTable: any;
    }) => Promise<{ outcome: number; multiplier?: number; details?: Record<string, any> }>,
  ): Promise<BetResult> {
    return this.runExclusive(ctx.user.userId, async () => {
      const cfg = await this.assertCanBet(ctx.user.userId, betAmount);
      const bundle = this.nextSeedBundle(ctx.user.userId, (revealed) => {
        ctx.emit('seedRotated', {
          revealed: pf.toPersisted(revealed, { reveal: true }),
          next: { serverSeedHash: this.userSeeds.get(ctx.user.userId)?.serverSeedHash },
        });
      });

      const persistedAtStart = pf.toPersisted(bundle, { reveal: false });
      const { sessionId, balance: postDebit } = await this.startSession(
        ctx.user.userId,
        betAmount,
        persistedAtStart,
      );

      const result = await compute({
        seed: bundle,
        houseEdge: cfg.houseEdge,
        payoutTable: cfg.payoutTable,
      });

      const persistedAtEnd = pf.toPersisted(bundle, { reveal: true });
      const finalBalance = await this.endSession(ctx.user.userId, sessionId, betAmount, {
        outcome: result.outcome,
        finalMultiplier: result.multiplier,
        resultDetails: result.details ?? null,
        seeds: persistedAtEnd,
        completed: true,
      });

      return {
        sessionId,
        betAmount,
        balance: finalBalance > 0 ? finalBalance : postDebit,
        outcome: result.outcome,
        finalMultiplier: result.multiplier,
        resultDetails: result.details,
        seeds: persistedAtEnd,
        completed: true,
      };
    });
  }
}

/** Minimal state every multi-step instant session must carry. Subclasses extend. */
export interface InstantSession {
  sessionId: number;
  betAmount: number;
  seeds: PersistedSeeds;
  startedAt: number;
}

interface UserSeedState {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nextNonce: number;
}

// Re-export the action result type so subclasses can write cleaner imports.
export type { ActionResult };
