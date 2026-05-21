/**
 * Crash-specific types.
 *
 * The public Socket.IO contract is described in the rebuild plan and the
 * existing `crashHandler.ts`. Keep these shapes aligned with that surface.
 */

import type { ActiveBet } from '../_engine/rounds.js';

/** Payload accepted by the `placeBet` event. */
export interface CrashBetPayload {
  amount: number;
  autoCashoutAt?: number;
}

/** Public result of a settled round. */
export interface CrashRoundResult {
  crashPoint: number;
}

/**
 * Extends the generic `ActiveBet` with Crash-specific transient fields tracked
 * during the running phase. `autoCashoutAt` lives on `choice` (set by
 * `betSchema`) but we expose convenience copies on the bet itself for the
 * tick loop.
 */
export interface CrashActiveBet extends ActiveBet {
  /** Multiplier threshold at which an auto-cashout should fire (undefined = no auto). */
  autoCashoutAt?: number;
  /** Has this bet been cashed out (manually or automatically) this round. */
  cashedOut: boolean;
  /** Multiplier at which the cashout happened, if any. */
  cashedOutAt: number | null;
  /** Profit (winAmount - bet.amount) recorded at cashout. */
  profit: number;
  /** Avatar reference for broadcast events (null when unknown). */
  avatar: string | null;
}

/** Snapshot returned to a newly-joined client (mirrors legacy `gameState` event). */
export interface CrashGameStateSnapshot {
  isGameRunning: boolean;
  isGameStarting: boolean;
  currentMultiplier: number;
  timeUntilStart: number | null;
}

/** Item stored in the recent-history list. */
export interface CrashHistoryEntry {
  gameId: string;
  crashPoint: number;
  timestamp: number;
}

/** Player presence record broadcast via `activePlayers` / `playerJoined`. */
export interface CrashActivePlayer {
  id: number;
  username: string;
  avatar: string | null;
  joinedAt: number;
}
