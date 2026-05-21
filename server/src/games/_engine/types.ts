/**
 * Shared type vocabulary for the rebuilt game engines.
 *
 * Engines extend either RoundBasedEngine (Crash, Roulette, Wheel) or
 * InstantResolveEngine (Blackjack, Plinko, Landmines, Dice, Slots).
 * Both consume the types here so the namespace registration helper, the
 * provably-fair wrapper, and per-game engines all speak the same shapes.
 *
 * Keep this file additive — the existing public Socket.IO event names and
 * `gameSessions` columns are part of the casino's external contract.
 */
import type { Namespace, Socket } from 'socket.io';

/** Set of game identifiers that match the `gameTypeEnum` and `GameConfigService` keys. */
export type GameType =
  | 'crash'
  | 'roulette'
  | 'wheel'
  | 'blackjack'
  | 'plinko'
  | 'landmines'
  | 'dice'
  | 'slots';

/** User attached to a socket by `socketAuth` middleware. */
export interface AuthUser {
  userId: number;
  username: string;
  role: string;
  balance: number;
  isActive: boolean;
}

/**
 * Per-connection context handed to every engine hook. Avoids passing the raw
 * socket around when the engine only needs identity + a way to emit/broadcast.
 */
export interface PlayerCtx {
  socket: Socket;
  user: AuthUser;
  /** Emit to just this socket. */
  emit: (event: string, payload?: any) => void;
  /** Broadcast to everyone in the namespace (round-based games). */
  broadcast: (event: string, payload?: any) => void;
  /** The namespace this socket lives on. */
  namespace: Namespace;
}

/** Seed material produced by the provably-fair wrapper for a single RNG draw. */
export interface SeedBundle {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

/** Result of a single `pf.generate` call. */
export interface FairResult {
  /** Float in [0, 1) derived from HMAC-SHA256(serverSeed, clientSeed:nonce). */
  raw: number;
  seeds: SeedBundle;
}

/** Persisted seed material on a `gameSessions.gameState` row. `serverSeed` is null until reveal. */
export interface PersistedSeeds {
  serverSeedHash: string;
  serverSeed: string | null;
  clientSeed: string;
  nonce: number;
  roundId?: string | number | null;
}

/** Outcome returned by an engine's `onBet`/`onAction` hook. */
export interface OutcomeReport {
  /** Total payout returned to the player (0 for a loss, > 0 for a win). */
  outcome: number;
  /** Net multiplier of payout vs bet, if the game has a single one. */
  finalMultiplier?: number;
  /** Free-form details that admin analytics or the client may render. */
  resultDetails?: Record<string, any>;
  /** Snapshot of seed material for the row — reveal happens at `persistSessionEnd`. */
  seeds?: PersistedSeeds;
  /** Set true if this resolves the session row (`isCompleted = true`). */
  completed: boolean;
}

/** What an engine returns from `onBet`. */
export interface BetResult extends OutcomeReport {
  /** ID of the `gameSessions` row created by `persistSessionStart`. */
  sessionId: number;
  /** Amount actually debited (may be different from requested if normalised). */
  betAmount: number;
  /** Updated player balance after the bet (and any same-call payout). */
  balance: number;
}

/** What an engine returns from `onAction` (cashout, hit/stand, reveal, etc.). */
export interface ActionResult extends OutcomeReport {
  sessionId: number;
  balance: number;
}

/** Payload returned from `onJoin` — gives the client its initial state snapshot. */
export interface JoinPayload {
  /** Hash of the current round's server seed (round-based) or the player's next nonce (instant). */
  serverSeedHash?: string;
  /** Anything game-specific (current phase, history, open hands, …). */
  state?: Record<string, any>;
}

/** A factory that constructs a fresh engine instance — used by `registerGameNamespace`. */
export type EngineFactory<T> = () => T;
