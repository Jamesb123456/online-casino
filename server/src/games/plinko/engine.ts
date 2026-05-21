/**
 * Plinko engine — single-shot instant-resolve game.
 *
 * Each `plinko:drop_ball` is a complete round for that user: validate input,
 * draw a provably-fair seed bundle, walk a deterministic path through the
 * pegs, look up the bucket multiplier (with optional config-driven override),
 * settle the bet via the base class's `oneShot` helper, then broadcast a
 * sanitised result + ack the caller with the full path so the client can
 * replay the animation.
 *
 * Public Socket.IO contract preserved verbatim from `socket/plinkoHandler.ts`:
 *   in:   plinko:join, plinko:drop_ball (with ack), plinko:get_history, plinko:leave
 *   out:  balanceUpdate, plinko:game_result (broadcast)
 *   ack:  { success, gameId, path, multiplier, winAmount, profit, balance }
 */
import { InstantResolveEngine } from '../_engine/instant.js';
import { generatePath } from './path.js';
import { resolveBucketMultiplier, type PlinkoRisk } from './buckets.js';
import LoggingService from '../../services/loggingService.js';
import type { BetResult, GameType, JoinPayload, PlayerCtx } from '../_engine/types.js';

const VALID_RISKS: ReadonlyArray<PlinkoRisk> = ['low', 'medium', 'high'];
const MIN_ROWS = 8;
const MAX_ROWS = 16;
const MAX_HISTORY = 100;

interface PlinkoHistoryEntry {
  gameId: string;
  userId: number;
  betAmount: number;
  risk: PlinkoRisk;
  rows: number;
  multiplier: number;
  profit: number;
  timestamp: number;
}

interface PlinkoBetPayload {
  betAmount: number;
  risk: PlinkoRisk;
  rows: number;
}

export class PlinkoEngine extends InstantResolveEngine {
  readonly gameType: GameType = 'plinko';

  /** Bounded round history broadcast back on join, mirroring legacy behaviour. */
  protected readonly history: PlinkoHistoryEntry[] = [];

  // ── Validation ─────────────────────────────────────────────────────

  protected validatePayload(payload: any): PlinkoBetPayload {
    if (!payload || typeof payload !== 'object') {
      throw new Error('invalid_payload');
    }
    const betAmount = Number(payload.betAmount);
    if (!Number.isFinite(betAmount) || betAmount <= 0) {
      throw new Error('invalid_bet');
    }
    const risk = payload.risk as PlinkoRisk;
    if (!VALID_RISKS.includes(risk)) {
      throw new Error('invalid_risk');
    }
    const rows = Number(payload.rows);
    if (!Number.isInteger(rows) || rows < MIN_ROWS || rows > MAX_ROWS) {
      throw new Error('invalid_rows');
    }
    return { betAmount, risk, rows };
  }

  // ── Lifecycle hooks ────────────────────────────────────────────────

  override async onJoin(ctx: PlayerCtx): Promise<JoinPayload> {
    const base = await super.onJoin(ctx);
    // Legacy stateless-on-join behaviour: respond with recent global history
    // so the client can render the live feed. Most plinko UIs don't render
    // anything from join, but keeping this hook keeps the door open.
    return {
      ...base,
      state: {
        ...(base.state ?? {}),
        history: this.history.slice(-10),
      },
    };
  }

  // ── Bet flow ───────────────────────────────────────────────────────

  override async onBet(ctx: PlayerCtx, payload: any): Promise<BetResult> {
    const { betAmount, risk, rows } = this.validatePayload(payload);

    const result = await this.oneShot(ctx, betAmount, async ({ seed, payoutTable }) => {
      const { path, finalSlot } = generatePath(rows, seed);
      const override =
        payoutTable && typeof payoutTable === 'object' && !Array.isArray(payoutTable)
          ? (payoutTable as Record<string, Record<string, number[]>>)
          : null;
      const multiplier = resolveBucketMultiplier(rows, risk, finalSlot, override);
      const outcome = betAmount * multiplier;
      return {
        outcome,
        multiplier,
        details: { path, risk, rows, finalSlot, multiplier },
      };
    });

    // Pull the path back out of resultDetails so the ack carries the same
    // shape as the legacy handler.
    const details = (result.resultDetails ?? {}) as {
      path?: number[];
      finalSlot?: number;
    };
    const path = Array.isArray(details.path) ? details.path : [];
    const multiplier = result.finalMultiplier ?? 0;
    const winAmount = result.outcome;
    const profit = winAmount - betAmount;
    const gameId = String(result.sessionId);

    // Personal balance refresh (legacy emitted this even when winAmount=0).
    ctx.emit('balanceUpdate', { balance: result.balance });

    // Broadcast a sanitised result to the namespace.
    ctx.broadcast('plinko:game_result', {
      userId: ctx.user.userId,
      betAmount,
      multiplier,
      profit,
    });

    // Append to in-memory history (capped).
    this.history.push({
      gameId,
      userId: ctx.user.userId,
      betAmount,
      risk,
      rows,
      multiplier,
      profit,
      timestamp: Date.now(),
    });
    if (this.history.length > MAX_HISTORY) {
      this.history.splice(0, this.history.length - MAX_HISTORY);
    }

    LoggingService.logGameEvent('plinko', 'drop_resolved', {
      userId: ctx.user.userId,
      sessionId: result.sessionId,
      betAmount,
      risk,
      rows,
      multiplier,
      profit,
    });

    // Attach the ack-shaped payload onto resultDetails so the namespace
    // registration helper / caller can forward it through the socket ack.
    return {
      ...result,
      resultDetails: {
        ...(result.resultDetails ?? {}),
        ack: {
          success: true,
          gameId,
          path,
          multiplier,
          winAmount,
          profit,
          balance: result.balance,
        },
      },
    };
  }

  // ── Read-only history accessor (for plinko:get_history) ────────────

  getHistory(limit = 10): PlinkoHistoryEntry[] {
    const safeLimit = Number.isInteger(limit) && limit > 0 ? Math.min(limit, MAX_HISTORY) : 10;
    return this.history.slice(-safeLimit);
  }
}

export default PlinkoEngine;
