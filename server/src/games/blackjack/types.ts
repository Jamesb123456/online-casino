import type { InstantSession } from '../_engine/instant.js';
import type { Card } from './hand.js';

/**
 * Per-user blackjack session held in memory by `BlackjackEngine.sessions`.
 *
 * Cleared on completion or on disconnect (via `onAbandon`, which auto-stands
 * any open hand so the `gameSessions` row never lingers as `isCompleted=false`).
 */
export interface BlackjackSession extends InstantSession {
  /** Public game identifier emitted in every `blackjack_game_state` payload. */
  gameId: string;
  /** Remaining undealt cards. */
  shoe: Card[];
  playerHand: Card[];
  dealerHand: Card[];
  status: 'active' | 'completed';
  /** Snapshotted at game start so mid-hand config edits cannot change payouts. */
  payouts: { win: number; blackjack: number; push: number };
  /** True once the player has doubled — bet has already been multiplied. */
  doubled: boolean;
  /** Last decided result (filled at end of hand). */
  result?: 'player_win' | 'dealer_win' | 'push' | 'blackjack';
  /** Total returned to the player on settlement (0 for a loss). */
  winAmount?: number;
}
