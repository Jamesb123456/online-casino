import type { InstantSession } from '../_engine/instant.js';

/**
 * Per-user landmines session held in memory by `LandminesEngine.sessions`.
 *
 * Cleared on completion (mine hit / cashout / auto-cashout) or on disconnect
 * (via `onAbandon`, which marks the open hand as a loss so the
 * `gameSessions` row never lingers as `isCompleted=false`).
 */
export interface RevealedCell {
  row: number;
  col: number;
}

export interface LandminesSession extends InstantSession {
  /** Public game identifier emitted in every ack and broadcast. */
  gameId: string;
  /** Original bet amount. */
  betAmount: number;
  /** Number of mines on this board (1..24). */
  mines: number;
  /** 2D grid: true at (row,col) = mine, false = safe. */
  mineGrid: boolean[][];
  /** Cells the player has successfully revealed so far, in draw order. */
  revealed: RevealedCell[];
  /** False once cashed out, blown up, or abandoned. */
  isActive: boolean;
  /** Snapshotted at game start so a mid-game config edit cannot change payouts. */
  houseEdge: number;
}
