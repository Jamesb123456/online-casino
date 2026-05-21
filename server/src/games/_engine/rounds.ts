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
 * Base class for games that run a shared, namespace-wide round loop:
 * Crash, Roulette, Wheel.
 *
 * Phases progress: `betting` → `running` → `resolved` → `reveal` → (next).
 * One server seed per round; hash broadcast at `betting` start, seed revealed
 * at `reveal`. Bettors share a deterministic client seed derived from the
 * round id + their sorted user ids.
 *
 * Subclasses implement four small hooks:
 *   - `bettingDurationMs()` / `runningDurationMs()` / `revealDurationMs()`
 *   - `runRound(seed, bettors)` — the actual RNG draw + payout calc
 *   - `betSchema(payload)` — return validated `{ betAmount, choice }` for a
 *     player's `placeBet` call (or throw).
 */
export abstract class RoundBasedEngine extends GameEngine {
  /**
   * Live state for the in-flight round. Engines may add fields by widening
   * `RoundState` in their subclass file.
   */
  protected round: RoundState = makeIdleRound();

  /** Sockets currently connected to this namespace. */
  protected readonly subscribers: Set<PlayerCtx> = new Set();

  abstract bettingDurationMs(): number;
  abstract runningDurationMs(): number;
  abstract revealDurationMs(): number;

  /** Per-game RNG resolution; returns the result and any per-bettor payouts. */
  protected abstract runRound(
    seed: SeedBundle,
    bettors: ReadonlyArray<ActiveBet>,
  ): Promise<RoundResolution>;

  /** Validate the raw client payload for a bet event. Throw on rejection. */
  protected abstract betSchema(payload: any): { betAmount: number; choice: any };

  // ── Lifecycle ──────────────────────────────────────────────────────

  async onJoin(ctx: PlayerCtx): Promise<JoinPayload> {
    this.subscribers.add(ctx);
    return {
      serverSeedHash: this.round.seed?.serverSeedHash,
      state: {
        phase: this.round.phase,
        roundId: this.round.id,
        endsAt: this.round.endsAt,
      },
    };
  }

  async onDisconnect(ctx: PlayerCtx): Promise<void> {
    this.subscribers.delete(ctx);
  }

  async onBet(ctx: PlayerCtx, payload: any): Promise<BetResult> {
    return this.runExclusive(ctx.user.userId, async () => {
      if (this.round.phase !== 'betting') {
        throw new Error('not_betting_phase');
      }
      const { betAmount, choice } = this.betSchema(payload);
      const cfg = await this.assertCanBet(ctx.user.userId, betAmount);

      // Provisional seed bundle for this bettor — the actual draw happens at
      // round resolve, but we persist the hash now so the row has it.
      const bundle: SeedBundle = {
        serverSeed: this.round.seed!.serverSeed,
        serverSeedHash: this.round.seed!.serverSeedHash,
        clientSeed: pf.deterministicClientSeed(this.round.id!, [ctx.user.userId]),
        nonce: 0, // round-based games use one draw per round; nonce stays 0
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

      // Notify just the bettor that the bet succeeded; subclasses may add
      // broadcasts (e.g. Crash player-joined feeds).
      ctx.emit('betPlaced', {
        sessionId,
        betAmount,
        balance,
        choice,
        roundId: this.round.id,
      });

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
   * Bridge for the generic `onAction` hook — round-based games currently use
   * it for cashout (Crash) and similar. Subclasses override directly.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override async onAction(_ctx: PlayerCtx, action: string, _payload: any): Promise<ActionResult> {
    throw new Error(`unsupported_action:${action}`);
  }

  // ── Helpers subclasses can use ─────────────────────────────────────

  protected broadcast(event: string, payload?: any): void {
    for (const sub of this.subscribers) {
      sub.emit(event, payload);
    }
  }

  /**
   * Open a new round. Engines call this from their tick loop. Sets up seed
   * material, broadcasts the hash, transitions to `betting`.
   */
  protected openRound(): void {
    const { serverSeed, serverSeedHash } = pf.newServerSeed();
    const roundId = generateRoundId();
    const endsAt = Date.now() + this.bettingDurationMs();
    this.round = {
      id: roundId,
      phase: 'betting',
      bets: [],
      seed: { serverSeed, serverSeedHash, clientSeed: '', nonce: 0 },
      endsAt,
    };
    this.broadcast('gameState', {
      phase: 'betting',
      roundId,
      serverSeedHash,
      endsAt,
    });
  }

  /**
   * Resolve the open round. Calls the subclass's `runRound` to produce
   * outcomes per bettor, then closes every session row.
   */
  protected async resolveRound(): Promise<void> {
    if (this.round.phase !== 'running') return;
    const seed: SeedBundle = {
      serverSeed: this.round.seed!.serverSeed,
      serverSeedHash: this.round.seed!.serverSeedHash,
      clientSeed: pf.deterministicClientSeed(this.round.id!, this.round.bets.map((b) => b.userId)),
      nonce: 0,
    };

    let resolution: RoundResolution;
    try {
      resolution = await this.runRound(seed, this.round.bets);
    } catch (err) {
      LoggingService.logSystemEvent('round_resolve_failed', {
        gameType: this.gameType,
        error: err instanceof Error ? err.message : String(err),
      }, 'error');
      this.round.phase = 'idle';
      return;
    }

    this.round.phase = 'resolved';

    // Settle each bet.
    for (const payout of resolution.payouts) {
      const bet = this.round.bets.find((b) => b.userId === payout.userId);
      if (!bet) continue;
      const persisted: PersistedSeeds = pf.toPersisted(
        { ...seed, clientSeed: pf.deterministicClientSeed(this.round.id!, [bet.userId]) },
        { reveal: true, roundId: this.round.id },
      );
      try {
        const balance = await this.endSession(bet.userId, bet.sessionId, bet.betAmount, {
          outcome: payout.outcome,
          finalMultiplier: payout.multiplier,
          resultDetails: payout.details ?? null,
          seeds: persisted,
          completed: true,
        });
        bet.socket.emit('roundComplete', {
          sessionId: bet.sessionId,
          outcome: payout.outcome,
          multiplier: payout.multiplier,
          balance,
          serverSeed: seed.serverSeed,
          serverSeedHash: seed.serverSeedHash,
          clientSeed: persisted.clientSeed,
          details: payout.details ?? null,
        });
      } catch (err) {
        LoggingService.logSystemEvent('round_settle_failed', {
          gameType: this.gameType,
          userId: bet.userId,
          error: err instanceof Error ? err.message : String(err),
        }, 'error');
      }
    }

    // Broadcast the public round result.
    this.broadcast('gameState', {
      phase: 'reveal',
      roundId: this.round.id,
      result: resolution.publicResult,
      serverSeed: seed.serverSeed,
      serverSeedHash: seed.serverSeedHash,
    });
  }

  /**
   * Move from betting → running. Engines invoke this when the betting timer
   * elapses. After running duration elapses, the engine calls `resolveRound`.
   */
  protected lockBetting(): void {
    if (this.round.phase !== 'betting') return;
    this.round.phase = 'running';
    this.round.endsAt = Date.now() + this.runningDurationMs();
    this.broadcast('gameState', {
      phase: 'running',
      roundId: this.round.id,
      endsAt: this.round.endsAt,
    });
  }
}

export type RoundPhase = 'idle' | 'betting' | 'running' | 'resolved' | 'reveal';

export interface ActiveBet {
  userId: number;
  username: string;
  sessionId: number;
  betAmount: number;
  choice: any;
  cashedOut: boolean;
  socket: import('socket.io').Socket;
}

export interface RoundResolution {
  /** Per-bettor payouts (outcome of 0 = loss). */
  payouts: Array<{
    userId: number;
    outcome: number;
    multiplier?: number;
    details?: Record<string, any>;
  }>;
  /** Public round outcome (e.g. crash multiplier, roulette number, wheel segment). */
  publicResult: Record<string, any>;
}

interface RoundState {
  id: string | number | null;
  phase: RoundPhase;
  bets: ActiveBet[];
  seed: SeedBundle | null;
  endsAt: number;
}

function makeIdleRound(): RoundState {
  return { id: null, phase: 'idle', bets: [], seed: null, endsAt: 0 };
}

function generateRoundId(): string {
  // Short collision-safe id — 12 hex chars is enough for a single namespace.
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
