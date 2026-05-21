// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks (hoisted so the engine sees them on import)
// ---------------------------------------------------------------------------
const {
  mockGetConfig,
  mockAssertCanBet,
  mockPlaceBet,
  mockRecordWin,
  mockGetBalance,
  mockHasSufficientBalance,
  mockDbInsert,
  mockDbUpdate,
  mockValuesReturn,
  mockSetReturn,
  mockWhereReturn,
  mockCreateShoe,
} = vi.hoisted(() => {
  const mockWhereReturn = vi.fn().mockResolvedValue(undefined);
  const mockSetReturn = vi.fn(() => ({ where: mockWhereReturn }));
  const mockValuesReturn = vi.fn().mockResolvedValue([{ insertId: 99 }]);
  const mockDbInsert = vi.fn(() => ({ values: mockValuesReturn }));
  const mockDbUpdate = vi.fn(() => ({ set: mockSetReturn }));
  return {
    mockGetConfig: vi.fn(),
    mockAssertCanBet: vi.fn(),
    mockPlaceBet: vi.fn(),
    mockRecordWin: vi.fn(),
    mockGetBalance: vi.fn(),
    mockHasSufficientBalance: vi.fn(),
    mockDbInsert,
    mockDbUpdate,
    mockValuesReturn,
    mockSetReturn,
    mockWhereReturn,
    mockCreateShoe: vi.fn(),
  };
});

vi.mock('../../../../drizzle/db.js', () => ({
  db: { insert: mockDbInsert, update: mockDbUpdate },
}));

vi.mock('../../../../drizzle/schema.js', () => ({
  gameSessions: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}));

vi.mock('../../../services/balanceService.js', () => ({
  default: {
    placeBet: mockPlaceBet,
    recordWin: mockRecordWin,
    getBalance: mockGetBalance,
    hasSufficientBalance: mockHasSufficientBalance,
  },
}));

vi.mock('../../../services/gameConfigService.js', () => ({
  default: { getConfig: mockGetConfig },
}));

vi.mock('../../../services/userLimitsService.js', () => ({
  default: {
    assertCanBet: mockAssertCanBet,
    clearSession: vi.fn(),
  },
}));

vi.mock('../../../services/loggingService.js', () => ({
  default: {
    logSystemEvent: vi.fn(),
    logGameEvent: vi.fn(),
    logGameAction: vi.fn(),
  },
}));

// Mock the shoe builder so we can stamp a deterministic deck per test.
vi.mock('../../../games/blackjack/shoe.js', async () => {
  const actual: any = await vi.importActual('../../../games/blackjack/shoe.js');
  return {
    ...actual,
    createShoe: (...args: any[]) => mockCreateShoe(...args),
  };
});

// ---------------------------------------------------------------------------
// Module under test
// ---------------------------------------------------------------------------
import { BlackjackEngine } from '../../../games/blackjack/engine.js';
import type { Card } from '../../../games/blackjack/hand.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function card(rank: string, suit = 'hearts'): Card {
  return { rank, suit };
}

/**
 * Build a deck that yields the given dealing order via `pop()` from the end.
 * Engine deal order: player[0], player[1], dealer[0], dealer[1], then any
 * subsequent hit/double draws. `pop()` reads the tail of the array, so we
 * reverse the desired-draw order.
 */
function deckFromDealOrder(...dealOrder: Card[]): Card[] {
  return [...dealOrder].reverse();
}

function makeCtx(userId = 7, username = 'p7') {
  const emitted: Array<{ event: string; payload: any }> = [];
  return {
    socket: { id: `s${userId}`, emit: vi.fn() } as any,
    user: { userId, username, role: 'user', balance: 1000, isActive: true },
    emit: (event: string, payload?: any) => emitted.push({ event, payload }),
    broadcast: vi.fn(),
    namespace: {} as any,
    _emitted: emitted,
  };
}

function emittedBy(ctx: any, event: string): any[] {
  return ctx._emitted.filter((e: any) => e.event === event).map((e: any) => e.payload);
}

function setShoe(...dealOrder: Card[]) {
  // Use mockReturnValue (not mockReturnValueOnce) — vi.clearAllMocks() does
  // NOT clear the `Once` queue, so leftover queued values from prior tests
  // would leak into the next one.
  mockCreateShoe.mockReturnValue(deckFromDealOrder(...dealOrder));
}

beforeEach(() => {
  // resetAllMocks clears both call history AND the `Once` queues / impls —
  // critical because `mockReturnValueOnce`/`mockResolvedValueOnce` survive
  // a plain clearAllMocks and would leak between tests.
  vi.resetAllMocks();
  mockGetConfig.mockResolvedValue({
    enabled: true,
    maxBet: 5000,
    houseEdge: 0.02,
    payoutTable: { win: 2.0, blackjack: 2.5, push: 1.0 },
  });
  mockAssertCanBet.mockResolvedValue({ ok: true });
  mockValuesReturn.mockResolvedValue([{ insertId: 99 }]);
  mockSetReturn.mockImplementation(() => ({ where: mockWhereReturn }));
  mockWhereReturn.mockResolvedValue(undefined);
  mockDbInsert.mockImplementation(() => ({ values: mockValuesReturn }));
  mockDbUpdate.mockImplementation(() => ({ set: mockSetReturn }));
  mockPlaceBet.mockResolvedValue({ user: { balance: '900' } });
  mockRecordWin.mockResolvedValue({ user: { balance: '1100' } });
  mockGetBalance.mockResolvedValue(900);
  mockHasSufficientBalance.mockResolvedValue(true);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BlackjackEngine.onBet validation', () => {
  it('rejects an invalid betAmount with a descriptive error', async () => {
    const engine = new BlackjackEngine();
    const ctx = makeCtx();
    setShoe(card('5'), card('5'), card('5'), card('5'));
    await expect(engine.onBet(ctx, { betAmount: -10 })).rejects.toThrow();
    expect(mockPlaceBet).not.toHaveBeenCalled();
  });

  it('rejects a second blackjack_start while a hand is active', async () => {
    const engine = new BlackjackEngine();
    const ctx = makeCtx();
    // Player 5+5=10, dealer 5+5=10 — no natural blackjack, hand stays active.
    // Deal order: player[0], player[1], dealer[0], dealer[1]
    setShoe(card('5'), card('5'), card('5'), card('5'));
    await engine.onBet(ctx, { betAmount: 100 });

    await expect(engine.onBet(ctx, { betAmount: 100 })).rejects.toThrow(/active/i);
  });

  it('propagates game_disabled from assertCanBet', async () => {
    mockGetConfig.mockResolvedValue({ enabled: false, maxBet: 5000, houseEdge: 0, payoutTable: {} });
    const engine = new BlackjackEngine();
    const ctx = makeCtx();
    await expect(engine.onBet(ctx, { betAmount: 100 })).rejects.toThrow('game_disabled');
  });
});

describe('BlackjackEngine.onBet — opening deal', () => {
  it('opens a session, deals 2/2, and emits initial state with one dealer card', async () => {
    const engine = new BlackjackEngine();
    const ctx = makeCtx();
    // Deal order: player[0]=5, player[1]=9, dealer[0]=K, dealer[1]=7
    setShoe(card('5'), card('9'), card('K'), card('7'));

    const result = await engine.onBet(ctx, { betAmount: 100 });

    expect(mockPlaceBet).toHaveBeenCalledWith(7, 100, 'blackjack', { gameSessionId: 99 });
    expect(result.sessionId).toBe(99);
    expect(result.completed).toBe(false);

    const states = emittedBy(ctx, 'blackjack_game_state');
    expect(states.length).toBe(1);
    const state = states[0];
    expect(state.playerHand).toEqual([card('5'), card('9')]);
    expect(state.dealerHand).toEqual([card('K')]); // hole card hidden
    expect(state.status).toBe('active');
    expect(state.canDouble).toBe(true);

    // Balance update on debit.
    expect(emittedBy(ctx, 'balanceUpdate')[0]).toEqual({ balance: 900 });
  });
});

describe('BlackjackEngine — hit', () => {
  it('adds a card to the player hand and stays active when not busted', async () => {
    const engine = new BlackjackEngine();
    const ctx = makeCtx();
    // Deal order: player[0]=5, player[1]=5, dealer[0]=K, dealer[1]=7, then hit=4
    // player 5+5=10, dealer K+7=17, hit draws 4 → player 14
    setShoe(card('5'), card('5'), card('K'), card('7'), card('4'));

    await engine.onBet(ctx, { betAmount: 100 });
    const hitResult = await engine.onAction(ctx, 'hit', {});

    expect(hitResult.completed).toBe(false);
    const states = emittedBy(ctx, 'blackjack_game_state');
    const after = states[states.length - 1];
    expect(after.playerHand).toEqual([card('5'), card('5'), card('4')]);
    expect(after.status).toBe('active');
    expect(mockRecordWin).not.toHaveBeenCalled();
  });

  it('busts and auto-resolves as a dealer_win when player exceeds 21', async () => {
    const engine = new BlackjackEngine();
    const ctx = makeCtx();
    // Deal order: player[0]=K, player[1]=9, dealer[0]=5, dealer[1]=7, then hit=K
    // player K+9=19, hit K → 29 bust
    setShoe(card('K'), card('9'), card('5'), card('7'), card('K'));

    await engine.onBet(ctx, { betAmount: 100 });
    const hitResult = await engine.onAction(ctx, 'hit', {});

    expect(hitResult.completed).toBe(true);
    expect(hitResult.outcome).toBe(0);
    expect(mockRecordWin).not.toHaveBeenCalled();

    const states = emittedBy(ctx, 'blackjack_game_state');
    const final = states[states.length - 1];
    expect(final.status).toBe('completed');
    expect(final.result).toBe('dealer_win');
    expect(final.dealerHand.length).toBe(2); // hole card revealed
  });
});

describe('BlackjackEngine — stand', () => {
  it('plays dealer until 17+ and pays win multiplier when player beats dealer', async () => {
    const engine = new BlackjackEngine();
    const ctx = makeCtx();
    // Deal order: player[0]=10, player[1]=10, dealer[0]=5, dealer[1]=9, then dealer hits=3
    // player 20, dealer starts at 14 → hits → 17 stands. Player 20 wins.
    setShoe(card('10'), card('10'), card('5'), card('9'), card('3'));

    await engine.onBet(ctx, { betAmount: 100 });
    const standResult = await engine.onAction(ctx, 'stand', {});

    expect(standResult.completed).toBe(true);
    expect(standResult.outcome).toBe(200); // 100 * 2.0
    expect(mockRecordWin).toHaveBeenCalledWith(7, 100, 200, 'blackjack', { gameSessionId: 99 });

    const final = emittedBy(ctx, 'blackjack_game_state').pop();
    expect(final.status).toBe('completed');
    expect(final.result).toBe('player_win');
    expect(final.dealerHand.length).toBe(3); // 5, 9, 3 — full dealer hand revealed
  });

  it('returns the bet (push) on equal scores', async () => {
    const engine = new BlackjackEngine();
    const ctx = makeCtx();
    // Deal order: player[0]=10, player[1]=9, dealer[0]=10, dealer[1]=9
    // player 19, dealer 19 → push
    setShoe(card('10'), card('9'), card('10'), card('9'));

    await engine.onBet(ctx, { betAmount: 100 });
    const standResult = await engine.onAction(ctx, 'stand', {});

    expect(standResult.completed).toBe(true);
    expect(standResult.outcome).toBe(100);
    expect(mockRecordWin).toHaveBeenCalledWith(7, 100, 100, 'blackjack', { gameSessionId: 99 });

    const final = emittedBy(ctx, 'blackjack_game_state').pop();
    expect(final.result).toBe('push');
  });

  it('records 0 outcome when dealer beats player', async () => {
    const engine = new BlackjackEngine();
    const ctx = makeCtx();
    // Deal order: player[0]=5, player[1]=9, dealer[0]=K, dealer[1]=8
    // player 14, dealer 18 → dealer_win
    setShoe(card('5'), card('9'), card('K'), card('8'));

    await engine.onBet(ctx, { betAmount: 100 });
    const standResult = await engine.onAction(ctx, 'stand', {});

    expect(standResult.completed).toBe(true);
    expect(standResult.outcome).toBe(0);
    expect(mockRecordWin).not.toHaveBeenCalled();
    const final = emittedBy(ctx, 'blackjack_game_state').pop();
    expect(final.result).toBe('dealer_win');
  });
});

describe('BlackjackEngine — double', () => {
  it('debits a second stake, draws one card, auto-stands and resolves', async () => {
    const engine = new BlackjackEngine();
    const ctx = makeCtx();
    // Deal order: player[0]=5, player[1]=5, dealer[0]=K, dealer[1]=7, then double draws 9
    // player 5+5=10 → double→ +9 = 19 stands; dealer K+7=17 stands; player 19 vs 17 → win
    setShoe(card('5'), card('5'), card('K'), card('7'), card('9'));

    await engine.onBet(ctx, { betAmount: 100 });

    // Second placeBet call expected for the double.
    mockPlaceBet.mockResolvedValueOnce({ user: { balance: '800' } });

    const dblResult = await engine.onAction(ctx, 'double', {});

    expect(mockPlaceBet).toHaveBeenCalledTimes(2);
    // Second debit is the original (unmoved) bet — engine doubles the
    // session's betAmount after the call.
    const secondDebit = mockPlaceBet.mock.calls[1];
    expect(secondDebit[0]).toBe(7);
    expect(secondDebit[1]).toBe(100);
    expect(secondDebit[2]).toBe('blackjack');
    expect(secondDebit[3]).toMatchObject({ gameSessionId: 99, action: 'double_down' });

    expect(dblResult.completed).toBe(true);
    // Final bet is 200; player wins at 2.0 → outcome 400
    expect(dblResult.outcome).toBe(400);
    expect(mockRecordWin).toHaveBeenCalledWith(7, 200, 400, 'blackjack', { gameSessionId: 99 });

    const final = emittedBy(ctx, 'blackjack_game_state').pop();
    expect(final.status).toBe('completed');
    expect(final.betAmount).toBe(200);
  });

  it('rejects double if balance insufficient', async () => {
    const engine = new BlackjackEngine();
    const ctx = makeCtx();
    setShoe(card('5'), card('5'), card('K'), card('7'), card('9'));
    await engine.onBet(ctx, { betAmount: 100 });

    mockHasSufficientBalance.mockResolvedValueOnce(false);
    await expect(engine.onAction(ctx, 'double', {})).rejects.toThrow(/insufficient/i);
    // No second debit, no payout
    expect(mockPlaceBet).toHaveBeenCalledTimes(1);
    expect(mockRecordWin).not.toHaveBeenCalled();
  });
});

describe('BlackjackEngine — natural blackjack', () => {
  it('auto-resolves with the blackjack multiplier when dealer does not also have 21', async () => {
    const engine = new BlackjackEngine();
    const ctx = makeCtx();
    // Deal order: player[0]=A, player[1]=K, dealer[0]=5, dealer[1]=9
    // player A+K = 21 (natural), dealer 5+9=14
    setShoe(card('A'), card('K'), card('5'), card('9'));

    const result = await engine.onBet(ctx, { betAmount: 100 });

    expect(result.completed).toBe(true);
    expect(result.outcome).toBe(250); // 100 * 2.5
    expect(mockRecordWin).toHaveBeenCalledWith(7, 100, 250, 'blackjack', { gameSessionId: 99 });

    const final = emittedBy(ctx, 'blackjack_game_state').pop();
    expect(final.status).toBe('completed');
    expect(final.result).toBe('blackjack');
  });
});

describe('BlackjackEngine.onAbandon', () => {
  it('auto-stands an open hand on disconnect and settles the session', async () => {
    const engine = new BlackjackEngine();
    const ctx = makeCtx();
    // Deal order: player[0]=5, player[1]=5, dealer[0]=K, dealer[1]=7
    // player 10, dealer 17 stands → dealer wins
    setShoe(card('5'), card('5'), card('K'), card('7'));

    await engine.onBet(ctx, { betAmount: 100 });
    // Sanity: still active.
    expect((engine as any).sessions.get(7).status).toBe('active');

    await engine.onDisconnect(ctx);

    // Session should be cleared by the base's onDisconnect.
    expect((engine as any).sessions.has(7)).toBe(false);
    // endSession path is exercised — db.update should have been called for
    // the session row.
    expect(mockDbUpdate).toHaveBeenCalled();
  });
});

describe('BlackjackEngine — concurrent actions are serialised', () => {
  it('runs two concurrent hits one after the other (runExclusive)', async () => {
    const engine = new BlackjackEngine();
    const ctx = makeCtx();
    // Deal order: player[0]=2, player[1]=2, dealer[0]=K, dealer[1]=7, hits 3, 4
    // player 2+2=4 → +3 = 7 → +4 = 11, still active
    setShoe(card('2'), card('2'), card('K'), card('7'), card('3'), card('4'));

    await engine.onBet(ctx, { betAmount: 100 });

    const p1 = engine.onAction(ctx, 'hit', {});
    const p2 = engine.onAction(ctx, 'hit', {});
    await Promise.all([p1, p2]);

    const session = (engine as any).sessions.get(7);
    // Both hits ran — 2 + 2 + 3 + 4 = 11, hand still active.
    expect(session.playerHand.length).toBe(4);
    expect(session.status).toBe('active');
  });
});
