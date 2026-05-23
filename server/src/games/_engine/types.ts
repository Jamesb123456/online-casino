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

// ── Per-game bet/action payload shapes ─────────────────────────────────
//
// These types narrow the engine ↔ bindEvents boundary. The bindEvents layer
// still accepts raw `any` payloads from socket.io and passes them through to
// engines; engines validate (via Zod or inline checks) before reading fields.
// The shapes here describe what an engine *will look at* on the payload, with
// optional fields used generously so the existing validators still see the
// same wire-format. Types are intentionally permissive — `strict: false`.

/** `placeBet` payload for Crash. */
export interface CrashBetPayload {
  amount?: number;
  autoCashoutAt?: number;
  [k: string]: any;
}

/** `roulette:place_bet` payload for Roulette. */
export interface RouletteBetPayload {
  type?: string;
  value?: string | number | null;
  amount?: number;
  [k: string]: any;
}

/** `wheel:place_bet` payload for Wheel. */
export interface WheelBetPayload {
  betAmount?: number;
  difficulty?: 'easy' | 'medium' | 'hard' | string;
  [k: string]: any;
}

/** `blackjack_start` payload for Blackjack. */
export interface BlackjackBetPayload {
  betAmount?: number;
  [k: string]: any;
}

/**
 * Blackjack action payloads. Hit/stand/double take no fields in the legacy
 * wire format, so this is effectively empty — kept as an interface so the
 * binding layer has a stable name to import.
 */
export interface BlackjackActionPayload {
  [k: string]: any;
}

/** `plinko:drop_ball` payload for Plinko. */
export interface PlinkoBetPayload {
  betAmount?: number;
  risk?: 'low' | 'medium' | 'high' | string;
  rows?: number;
  [k: string]: any;
}

/** `landmines:start` payload (opens a Landmines session). */
export interface LandminesBetPayload {
  betAmount?: number;
  mines?: number;
  [k: string]: any;
}

/**
 * Landmines action payload. `reveal` carries `{ row, col }`; `cashout` carries
 * nothing. Combined into a single permissive shape so `onAction` can accept
 * either.
 */
export interface LandminesActionPayload {
  row?: number;
  col?: number;
  [k: string]: any;
}

/** `dice:roll` payload for Dice. */
export interface DiceBetPayload {
  betAmount?: number;
  target?: number;
  direction?: 'under' | 'over' | string;
  [k: string]: any;
}

/** `slots:spin` payload for Slots. */
export interface SlotsBetPayload {
  betPerLine?: number;
  lines?: number;
  [k: string]: any;
}
