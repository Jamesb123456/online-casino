/**
 * Blackjack engine on top of `InstantResolveEngine`.
 *
 * Preserves the legacy Socket.IO contract from `server/src/socket/blackjackHandler.ts`
 * end-to-end:
 *
 *   inbound:  blackjack_start { betAmount }, blackjack_hit {}, blackjack_stand {},
 *             blackjack_double {}
 *   outbound: blackjack_game_state { gameId, playerHand, dealerHand, playerScore?,
 *             dealerScore?, betAmount, status, result?, winAmount?, canDouble?,
 *             canSplit? }, balanceUpdate { balance }, blackjack_error { message }
 *
 * What the base class buys us (vs. the legacy handler):
 *   - per-user lock (`runExclusive`) replaces the module-level `inFlightActions`
 *     Set — concurrent hit/stand/double for the same user serialise cleanly.
 *   - `gameSessions` row is opened on bet and closed on settle, so admin
 *     analytics finally sees blackjack hands.
 *   - balance debit/credit flow through `BalanceService` (decimal-safe, tx-safe).
 *   - provably-fair seed material (hash up-front, reveal at settle). One PF
 *     seed per hand; rotation happens through `nextSeedBundle`.
 *   - `onAbandon` auto-stands any open hand on disconnect, closing the leak that
 *     left rows as `isCompleted=false` in the legacy implementation.
 */
import { InstantResolveEngine, type InstantSession } from '../_engine/instant.js';
import pf from '../_engine/provablyFair.js';
import balanceService from '../../services/balanceService.js';
import LoggingService from '../../services/loggingService.js';
import { validateSocketData, blackjackStartSchema } from '../../validation/schemas.js';
import crypto from 'crypto';
import {
  calculateHandValue,
  determineWinner,
  isBlackjack,
  type Card,
} from './hand.js';
import { createShoe, draw } from './shoe.js';
import type { BlackjackSession } from './types.js';
import type {
  ActionResult,
  BetResult,
  GameType,
  JoinPayload,
  PersistedSeeds,
  PlayerCtx,
  SeedBundle,
} from '../_engine/types.js';

const DEFAULT_PAYOUTS = { win: 2.0, blackjack: 2.5, push: 1.0 } as const;

export class BlackjackEngine extends InstantResolveEngine<BlackjackSession> {
  readonly gameType: GameType = 'blackjack';

  // ── Lifecycle hooks ────────────────────────────────────────────────

  override async onJoin(ctx: PlayerCtx): Promise<JoinPayload> {
    const payload = await super.onJoin(ctx);
    // Resume any open hand on reconnect — emit current public-facing state.
    const session = this.sessions.get(ctx.user.userId);
    if (session && session.status === 'active') {
      ctx.emit('blackjack_game_state', this.publicState(session));
    }
    return payload;
  }

  /**
   * Auto-stand any open hand on disconnect. Plays the dealer, settles, and
   * persists `endSession` so the row doesn't dangle as `isCompleted=false`.
   */
  protected override async onAbandon(userId: number, session: BlackjackSession): Promise<void> {
    if (session.status !== 'active') return;
    try {
      await this.playDealerAndResolve(userId, session);
    } catch (err) {
      LoggingService.logSystemEvent('blackjack_abandon_resolve_failed', {
        userId,
        gameId: session.gameId,
        error: err instanceof Error ? err.message : String(err),
      }, 'warning');
    }
  }

  // ── Bet ───────────────────────────────────────────────────────────

  override async onBet(ctx: PlayerCtx, payload: any): Promise<BetResult> {
    return this.runExclusive(ctx.user.userId, async () => {
      // One active hand per user.
      const existing = this.sessions.get(ctx.user.userId);
      if (existing && existing.status === 'active') {
        throw new Error('You already have an active game');
      }

      // Validate input — same Zod schema the legacy handler used.
      let validated: any;
      try {
        validated = validateSocketData(blackjackStartSchema, payload);
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'invalid_payload');
      }
      const betAmount: number = validated.betAmount;
      if (!Number.isFinite(betAmount) || betAmount <= 0) {
        throw new Error('invalid_bet');
      }

      const cfg = await this.assertCanBet(ctx.user.userId, betAmount);

      // Snapshot payouts from config (with safe defaults) so mid-hand edits
      // can't change what this hand pays.
      const pt = (cfg.payoutTable && typeof cfg.payoutTable === 'object') ? cfg.payoutTable : {};
      const payouts = {
        win: typeof pt.win === 'number' ? pt.win : DEFAULT_PAYOUTS.win,
        blackjack: typeof pt.blackjack === 'number' ? pt.blackjack : DEFAULT_PAYOUTS.blackjack,
        push: typeof pt.push === 'number' ? pt.push : DEFAULT_PAYOUTS.push,
      };

      // Draw the provably-fair bundle and persist start state.
      const bundle = this.nextSeedBundle(ctx.user.userId, (revealed) => {
        ctx.emit('seedRotated', {
          revealed: pf.toPersisted(revealed, { reveal: true }),
          next: { serverSeedHash: this.userSeeds.get(ctx.user.userId)?.serverSeedHash },
        });
      });
      const persistedAtStart: PersistedSeeds = pf.toPersisted(bundle, { reveal: false });

      const { sessionId, balance: postDebit } = await this.startSession(
        ctx.user.userId,
        betAmount,
        persistedAtStart,
      );

      // Build the shoe and deal opening hands.
      const shoe = createShoe(bundle);
      const playerHand: Card[] = [draw(shoe), draw(shoe)];
      const dealerHand: Card[] = [draw(shoe), draw(shoe)];

      const gameId = this.generateGameId();
      const session: BlackjackSession = {
        sessionId,
        betAmount,
        seeds: persistedAtStart,
        startedAt: Date.now(),
        gameId,
        shoe,
        playerHand,
        dealerHand,
        status: 'active',
        payouts,
        doubled: false,
      };
      this.sessions.set(ctx.user.userId, session);

      // Broadcast balance after debit and the opening state (dealer up-card only).
      ctx.emit('balanceUpdate', { balance: postDebit });
      ctx.emit('blackjack_game_state', this.publicState(session));

      LoggingService.logGameEvent('blackjack', 'game_started', {
        gameId, userId: ctx.user.userId, betAmount,
      }, ctx.user.userId);

      // Natural blackjack auto-resolves — dealer doesn't get to play unless they
      // also have 21 (the determineWinner helper handles that as a push).
      if (isBlackjack(playerHand)) {
        const finalBalance = await this.resolveNoDealerDraw(ctx.user.userId, session);
        // Emit the completed-state payload so the client immediately sees the
        // hole card and final result (the earlier emit had status='active').
        ctx.emit('blackjack_game_state', this.publicState(session));
        ctx.emit('balanceUpdate', { balance: finalBalance });
        return {
          sessionId,
          betAmount,
          balance: finalBalance,
          outcome: session.winAmount ?? 0,
          finalMultiplier: this.multiplierForResult(session),
          resultDetails: this.resultDetails(session),
          seeds: pf.toPersisted(bundle, { reveal: true }),
          completed: true,
        };
      }

      return {
        sessionId,
        betAmount,
        balance: postDebit,
        outcome: 0,
        completed: false,
        seeds: persistedAtStart,
      };
    });
  }

  // ── Actions ───────────────────────────────────────────────────────

  override async onAction(ctx: PlayerCtx, action: string, _payload: any): Promise<ActionResult> {
    switch (action) {
      case 'hit':
        return this.runExclusive(ctx.user.userId, () => this.doHit(ctx));
      case 'stand':
        return this.runExclusive(ctx.user.userId, () => this.doStand(ctx));
      case 'double':
        return this.runExclusive(ctx.user.userId, () => this.doDouble(ctx));
      default:
        throw new Error(`unsupported_action_${action}`);
    }
  }

  private async doHit(ctx: PlayerCtx): Promise<ActionResult> {
    const userId = ctx.user.userId;
    const session = this.sessions.get(userId);
    if (!session || session.status !== 'active') {
      throw new Error('No active game found');
    }

    const card = draw(session.shoe);
    session.playerHand.push(card);
    const playerScore = calculateHandValue(session.playerHand);

    if (playerScore > 21) {
      // Bust — dealer wins outright, no dealer play.
      session.status = 'completed';
      session.result = 'dealer_win';
      session.winAmount = 0;
      const balance = await this.settleSession(userId, session);
      ctx.emit('blackjack_game_state', this.publicState(session));
      ctx.emit('balanceUpdate', { balance });
      this.sessions.delete(userId);
      return {
        sessionId: session.sessionId,
        balance,
        outcome: 0,
        finalMultiplier: 0,
        resultDetails: this.resultDetails(session),
        completed: true,
      };
    }

    ctx.emit('blackjack_game_state', this.publicState(session));
    return {
      sessionId: session.sessionId,
      balance: ctx.user.balance,
      outcome: 0,
      completed: false,
    };
  }

  private async doStand(ctx: PlayerCtx): Promise<ActionResult> {
    const userId = ctx.user.userId;
    const session = this.sessions.get(userId);
    if (!session || session.status !== 'active') {
      throw new Error('No active game found');
    }

    const balance = await this.playDealerAndResolve(userId, session);
    ctx.emit('blackjack_game_state', this.publicState(session));
    ctx.emit('balanceUpdate', { balance });
    return {
      sessionId: session.sessionId,
      balance,
      outcome: session.winAmount ?? 0,
      finalMultiplier: this.multiplierForResult(session),
      resultDetails: this.resultDetails(session),
      completed: true,
    };
  }

  private async doDouble(ctx: PlayerCtx): Promise<ActionResult> {
    const userId = ctx.user.userId;
    const session = this.sessions.get(userId);
    if (!session || session.status !== 'active' || session.playerHand.length !== 2) {
      throw new Error('Cannot double down');
    }

    // Debit the additional stake first — same path as the initial bet so the
    // house ledger + per-user limits all stay consistent. We re-use the original
    // bet amount as the second debit.
    const originalBet = session.betAmount;
    const hasFunds = await balanceService.hasSufficientBalance(userId, originalBet);
    if (!hasFunds) {
      throw new Error('Insufficient balance to double');
    }
    const debit = await balanceService.placeBet(userId, originalBet, this.gameType, {
      gameSessionId: session.sessionId,
      action: 'double_down',
    });
    const postDebit = Number((debit as any)?.user?.balance ?? 0);
    ctx.emit('balanceUpdate', { balance: postDebit });

    session.betAmount = originalBet * 2;
    session.doubled = true;

    // One card to the player, then auto-stand (unless they bust).
    const card = draw(session.shoe);
    session.playerHand.push(card);
    const playerScore = calculateHandValue(session.playerHand);

    let balance: number;
    if (playerScore > 21) {
      session.status = 'completed';
      session.result = 'dealer_win';
      session.winAmount = 0;
      balance = await this.settleSession(userId, session);
    } else {
      balance = await this.playDealerAndResolve(userId, session);
    }

    ctx.emit('blackjack_game_state', this.publicState(session));
    ctx.emit('balanceUpdate', { balance });
    return {
      sessionId: session.sessionId,
      balance,
      outcome: session.winAmount ?? 0,
      finalMultiplier: this.multiplierForResult(session),
      resultDetails: this.resultDetails(session),
      completed: true,
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────

  /**
   * Play the dealer to 17+ and settle the session.
   * Returns the post-settlement balance.
   */
  private async playDealerAndResolve(userId: number, session: BlackjackSession): Promise<number> {
    while (calculateHandValue(session.dealerHand) < 17) {
      session.dealerHand.push(draw(session.shoe));
    }
    return this.resolveOpenHand(userId, session);
  }

  /**
   * Resolve a hand where the dealer doesn't draw (natural blackjack path).
   */
  private async resolveNoDealerDraw(userId: number, session: BlackjackSession): Promise<number> {
    return this.resolveOpenHand(userId, session);
  }

  /**
   * Compute the result via `determineWinner`, set session fields, and persist
   * the session end via `endSession`. Returns the resulting balance.
   */
  private async resolveOpenHand(userId: number, session: BlackjackSession): Promise<number> {
    const playerScore = calculateHandValue(session.playerHand);
    const dealerScore = calculateHandValue(session.dealerHand);
    const { result, multiplierKey } = determineWinner(playerScore, dealerScore, session.playerHand);

    session.status = 'completed';
    session.result = result;
    if (multiplierKey === 'loss') {
      session.winAmount = 0;
    } else {
      const m = session.payouts[multiplierKey];
      // Round to 2dp (matches legacy `Math.round(...*100)/100`).
      session.winAmount = Math.round(session.betAmount * m * 100) / 100;
    }

    const balance = await this.settleSession(userId, session);
    this.sessions.delete(userId);
    return balance;
  }

  /**
   * Wrapper around `endSession` that uses the session's recorded seeds and
   * win amount. Always closes the row (`completed: true`).
   */
  private async settleSession(userId: number, session: BlackjackSession): Promise<number> {
    const persisted: PersistedSeeds = {
      ...session.seeds,
      // Reveal the server seed at settle. The `seeds` stored on the session
      // had `serverSeed: null` (set at startSession); we re-fetch via the
      // engine's userSeeds cache because the bundle for this hand is no
      // longer accessible. For safety, leave it null if not available — the
      // base endSession only writes `seeds` into gameState if non-null.
      serverSeed: session.seeds.serverSeed ?? this.userSeeds.get(userId)?.serverSeed ?? null,
    };
    return this.endSession(userId, session.sessionId, session.betAmount, {
      outcome: session.winAmount ?? 0,
      finalMultiplier: this.multiplierForResult(session),
      resultDetails: this.resultDetails(session),
      seeds: persisted,
      completed: true,
    });
  }

  private multiplierForResult(session: BlackjackSession): number {
    if (!session.result || !session.winAmount || session.winAmount <= 0) return 0;
    return session.winAmount / session.betAmount;
  }

  private resultDetails(session: BlackjackSession): Record<string, any> {
    return {
      gameId: session.gameId,
      result: session.result,
      playerScore: calculateHandValue(session.playerHand),
      dealerScore: calculateHandValue(session.dealerHand),
      playerHand: session.playerHand,
      dealerHand: session.dealerHand,
      doubled: session.doubled,
    };
  }

  /**
   * Build the `blackjack_game_state` payload — same shape as the legacy
   * handler. Dealer's hole card stays hidden while the hand is active.
   */
  private publicState(session: BlackjackSession): Record<string, any> {
    const completed = session.status === 'completed';
    const dealerHandView = completed ? session.dealerHand : [session.dealerHand[0]];
    return {
      gameId: session.gameId,
      playerHand: session.playerHand,
      dealerHand: dealerHandView,
      playerScore: calculateHandValue(session.playerHand),
      dealerScore: completed ? calculateHandValue(session.dealerHand) : null,
      betAmount: session.betAmount,
      status: session.status,
      result: session.result,
      winAmount: session.winAmount,
      canDouble: !completed && session.playerHand.length === 2 && !session.doubled,
      canSplit: this.canSplit(session.playerHand) && !completed,
    };
  }

  private canSplit(hand: Card[]): boolean {
    if (hand.length !== 2) return false;
    // Treat 10/J/Q/K as the same "value" for splitting purposes.
    const v = (card: Card) => {
      if (card.rank === 'A') return 11;
      if (card.rank === 'J' || card.rank === 'Q' || card.rank === 'K') return 10;
      return parseInt(card.rank, 10);
    };
    return v(hand[0]) === v(hand[1]);
  }

  private generateGameId(): string {
    return `bj_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }
}

export default BlackjackEngine;

// Re-export type used by InstantResolveEngine generic constraint just for
// downstream type clarity.
export type { InstantSession };
