/**
 * Landmines engine — multi-step instant-resolve game.
 *
 * Flow:
 *   1. `onBet({ betAmount, mines })` → debit, place mines, open session.
 *      Subsequent reveals / cashouts run against the in-memory session keyed
 *      by userId.
 *   2. `onAction(ctx, 'reveal', { row, col })` → flip a tile.
 *        - mine    → settle as a loss, clear the session.
 *        - safe    → bump multiplier; if all safes uncovered or the next-reveal
 *                    multiplier would exceed the cap, auto-cash-out.
 *        - else    → return the new multiplier + potential win.
 *   3. `onAction(ctx, 'cashout')` → settle at the current multiplier, clear
 *      the session, broadcast `landmines:player_cashout` to the namespace.
 *   4. `onAbandon` → mark any open session as a loss so admin analytics rows
 *      do not dangle as `isCompleted=false`.
 *
 * The engine *returns* ActionResults — it does NOT emit the ack callback
 * itself. The thin socket-binding layer (task C-7) is responsible for
 * mapping the result onto the legacy ack-callback shape.
 */
import { InstantResolveEngine, type ActionResult } from '../_engine/instant.js';
import pf from '../_engine/provablyFair.js';
import LoggingService from '../../services/loggingService.js';
import crypto from 'crypto';
import {
  GRID_SIZE,
  TOTAL_CELLS,
  MIN_MINES,
  MAX_MINES,
  placeMines,
  calculateMultiplier,
} from './board.js';
import type { LandminesSession } from './types.js';
import type {
  BetResult,
  GameType,
  LandminesActionPayload,
  LandminesBetPayload,
  PersistedSeeds,
  PlayerCtx,
} from '../_engine/types.js';
import { MAX_PAYOUT_MULTIPLIER } from '../../utils/gameUtils.js';

export class LandminesEngine extends InstantResolveEngine<LandminesSession> {
  readonly gameType: GameType = 'landmines';

  // ── Bet ────────────────────────────────────────────────────────────

  override async onBet(ctx: PlayerCtx, payload: LandminesBetPayload): Promise<BetResult> {
    return this.runExclusive(ctx.user.userId, async () => {
      const userId = ctx.user.userId;

      // Validate input.
      if (!payload || typeof payload !== 'object') {
        throw new Error('invalid_payload');
      }
      const betAmount = Number(payload.betAmount);
      const mines = Number(payload.mines);
      if (!Number.isFinite(betAmount) || betAmount <= 0) {
        throw new Error('invalid_bet');
      }
      if (!Number.isInteger(mines) || mines < MIN_MINES || mines > MAX_MINES) {
        throw new Error('invalid_mines');
      }

      // No second game on top of an active one — matches legacy semantics.
      if (this.sessions.has(userId)) {
        throw new Error('active_game_in_progress');
      }

      // Config + limits gate; throws on disabled / too-large / locked.
      const cfg = await this.assertCanBet(userId, betAmount);

      // Draw the seed bundle. Mines placement uses this bundle (and
      // increments the nonce per mine internally).
      const bundle = this.nextSeedBundle(userId, (revealed) => {
        ctx.emit('seedRotated', {
          revealed: pf.toPersisted(revealed, { reveal: true }),
          next: { serverSeedHash: this.userSeeds.get(userId)?.serverSeedHash },
        });
      });

      // Persist the seed at start (serverSeed null until end).
      const persistedAtStart: PersistedSeeds = pf.toPersisted(bundle, { reveal: false });

      // Open the session row + debit.
      const { sessionId, balance } = await this.startSession(userId, betAmount, persistedAtStart, {
        mines,
      });

      // Place mines deterministically from the bundle.
      const { mineGrid } = placeMines(mines, bundle);

      // Stash in-memory session for subsequent actions.
      const gameId = crypto.randomUUID();
      const session: LandminesSession = {
        sessionId,
        gameId,
        betAmount,
        mines,
        mineGrid,
        revealed: [],
        isActive: true,
        houseEdge: cfg.houseEdge,
        seeds: persistedAtStart,
        startedAt: Date.now(),
      };
      this.sessions.set(userId, session);

      // Emit balance update directly so the legacy outbound contract holds.
      ctx.emit('balanceUpdate', { balance });

      LoggingService.logBetPlaced('landmines', gameId, userId, betAmount, { mines });

      return {
        sessionId,
        betAmount,
        balance,
        outcome: 0,
        completed: false,
        seeds: persistedAtStart,
        resultDetails: { gameId, mines, gridSize: GRID_SIZE },
      };
    });
  }

  // ── Actions ────────────────────────────────────────────────────────

  override async onAction(ctx: PlayerCtx, action: string, payload: LandminesActionPayload): Promise<ActionResult> {
    if (action === 'reveal') return this.doReveal(ctx, payload);
    if (action === 'cashout') return this.doCashout(ctx);
    throw new Error(`unknown_action_${action}`);
  }

  private async doReveal(ctx: PlayerCtx, payload: LandminesActionPayload): Promise<ActionResult> {
    return this.runExclusive(ctx.user.userId, async () => {
      const userId = ctx.user.userId;
      const session = this.sessions.get(userId);
      if (!session || !session.isActive) {
        throw new Error('no_active_game');
      }

      if (!payload || typeof payload !== 'object') {
        throw new Error('invalid_payload');
      }
      const row = Number(payload.row);
      const col = Number(payload.col);
      if (
        !Number.isInteger(row) ||
        !Number.isInteger(col) ||
        row < 0 ||
        row >= GRID_SIZE ||
        col < 0 ||
        col >= GRID_SIZE
      ) {
        throw new Error('invalid_cell');
      }
      if (session.revealed.some((c) => c.row === row && c.col === col)) {
        throw new Error('cell_already_revealed');
      }

      const isMine = session.mineGrid[row][col] === true;
      const position = `${row},${col}`;

      if (isMine) {
        // Loss — settle the session at outcome 0.
        session.isActive = false;
        const persistedAtEnd: PersistedSeeds = { ...session.seeds, serverSeed: this.revealSeed(session) };
        const balance = await this.endSession(userId, session.sessionId, session.betAmount, {
          outcome: 0,
          finalMultiplier: 0,
          resultDetails: {
            gameId: session.gameId,
            mines: session.mines,
            revealedCells: session.revealed.length,
            minePosition: position,
            hitMine: true,
          },
          seeds: persistedAtEnd,
          completed: true,
        });
        this.sessions.delete(userId);

        return {
          sessionId: session.sessionId,
          balance,
          outcome: 0,
          finalMultiplier: 0,
          completed: true,
          seeds: persistedAtEnd,
          resultDetails: {
            hit: true,
            position,
            gameOver: true,
            fullGrid: session.mineGrid,
            winAmount: 0,
          },
        };
      }

      // Safe cell.
      session.revealed.push({ row, col });
      const revealedCount = session.revealed.length;
      const multiplier = calculateMultiplier(session.mines, revealedCount, session.houseEdge);
      const potentialWin = session.betAmount * multiplier;
      const remainingSafeCells = TOTAL_CELLS - session.mines - revealedCount;
      const nextMultiplier = calculateMultiplier(session.mines, revealedCount + 1, session.houseEdge);

      // Auto-cashout when either (a) no safe cells left, or (b) the next
      // reveal would push us past the global cap (parity with legacy).
      if (remainingSafeCells === 0 || nextMultiplier >= MAX_PAYOUT_MULTIPLIER) {
        return this.settleCashout(ctx, session, {
          autoFrom: { row, col, multiplier, potentialWin },
        });
      }

      // Persist intermediate state so a crash mid-hand still has a row.
      try {
        await this.updateSessionState(session.sessionId, {
          seeds: session.seeds,
          mines: session.mines,
          revealed: session.revealed,
          currentMultiplier: multiplier,
        });
      } catch (err) {
        LoggingService.logSystemEvent('landmines_persist_state_failed', {
          userId,
          error: err instanceof Error ? err.message : String(err),
        }, 'warning');
      }

      return {
        sessionId: session.sessionId,
        balance: -1, // caller does not need balance on a safe reveal
        outcome: 0,
        finalMultiplier: multiplier,
        completed: false,
        seeds: session.seeds,
        resultDetails: {
          hit: false,
          position,
          multiplier,
          potentialWin,
          remainingSafeCells,
          gameOver: false,
        },
      };
    });
  }

  private async doCashout(ctx: PlayerCtx): Promise<ActionResult> {
    return this.runExclusive(ctx.user.userId, async () => {
      const userId = ctx.user.userId;
      const session = this.sessions.get(userId);
      if (!session || !session.isActive) {
        throw new Error('no_active_game');
      }
      if (session.revealed.length === 0) {
        throw new Error('no_reveals_yet');
      }
      return this.settleCashout(ctx, session);
    });
  }

  /**
   * Shared settlement path used by both an explicit cashout and the
   * auto-cashout branch in `doReveal`. Caller is already inside
   * `runExclusive` so we do NOT re-enter the lock here.
   */
  private async settleCashout(
    ctx: PlayerCtx,
    session: LandminesSession,
    auto?: { autoFrom: { row: number; col: number; multiplier: number; potentialWin: number } },
  ): Promise<ActionResult> {
    if (!session.isActive) {
      throw new Error('game_already_ended');
    }
    session.isActive = false;

    const revealedCount = session.revealed.length;
    const multiplier = calculateMultiplier(session.mines, revealedCount, session.houseEdge);
    const winAmount = session.betAmount * multiplier;
    const profit = winAmount - session.betAmount;

    const persistedAtEnd: PersistedSeeds = { ...session.seeds, serverSeed: this.revealSeed(session) };

    const balance = await this.endSession(ctx.user.userId, session.sessionId, session.betAmount, {
      outcome: winAmount,
      finalMultiplier: multiplier,
      resultDetails: {
        gameId: session.gameId,
        mines: session.mines,
        revealedCells: revealedCount,
        multiplier,
        winAmount,
        profit,
        autoCashout: !!auto,
      },
      seeds: persistedAtEnd,
      completed: true,
    });

    this.sessions.delete(ctx.user.userId);

    // Emit balance update + broadcast cashout to the namespace.
    ctx.emit('balanceUpdate', { balance });
    ctx.broadcast('landmines:player_cashout', {
      userId: ctx.user.userId,
      betAmount: session.betAmount,
      mines: session.mines,
      multiplier,
      winAmount,
      profit,
    });

    return {
      sessionId: session.sessionId,
      balance,
      outcome: winAmount,
      finalMultiplier: multiplier,
      completed: true,
      seeds: persistedAtEnd,
      resultDetails: {
        winAmount,
        multiplier,
        profit,
        cashedOut: true,
        gameOver: true,
        fullGrid: session.mineGrid,
        autoCashout: !!auto,
        autoFrom: auto?.autoFrom,
      },
    };
  }

  /**
   * Resolve the revealed server seed for a session — pulled from the live
   * `userSeeds` cache if still present, otherwise null (the row will still
   * show the hash for verification, just not the raw seed).
   */
  private revealSeed(session: LandminesSession): string | null {
    // The seed bundle persisted at start carries the serverSeedHash; the raw
    // server seed lives in `userSeeds[userId].serverSeed` until rotation.
    for (const [, state] of this.userSeeds) {
      if (state.serverSeedHash === session.seeds.serverSeedHash) {
        return state.serverSeed;
      }
    }
    return null;
  }

  // ── Abandon ────────────────────────────────────────────────────────

  protected override async onAbandon(userId: number, session: LandminesSession): Promise<void> {
    if (!session.isActive) return;
    session.isActive = false;
    try {
      const persistedAtEnd: PersistedSeeds = { ...session.seeds, serverSeed: this.revealSeed(session) };
      await this.endSession(userId, session.sessionId, session.betAmount, {
        outcome: 0,
        finalMultiplier: 0,
        resultDetails: {
          gameId: session.gameId,
          mines: session.mines,
          revealedCells: session.revealed.length,
          abandoned: true,
        },
        seeds: persistedAtEnd,
        completed: true,
      });
    } catch (err) {
      LoggingService.logSystemEvent('landmines_abandon_failed', {
        userId,
        error: err instanceof Error ? err.message : String(err),
      }, 'warning');
    }
  }
}

export default LandminesEngine;
