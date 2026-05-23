/**
 * useBlackjackHand — unit tests for the extracted hand state machine.
 *
 * The hook owns:
 *   - phase ('betting' | 'active' | 'completed')
 *   - hand state (player/dealer cards, scores, gameId, activeBet, canDouble)
 *   - action handlers (deal/hit/stand/doubleDown/newHand) emitting the four
 *     blackjack_* socket events
 *   - keyboard shortcuts (H/S/D) during 'active'
 *
 * Render-layer concerns (sound, win burst, announcer) are injected as
 * callbacks so the hook can be exercised in isolation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Capture the events bag the hook hands to useGameSocket, plus a shared emit
// spy so we can assert on outbound socket traffic without spinning up a real
// socket.
const emitMock = vi.fn();
let capturedEvents = {};
let socketStatusValue = 'connected';

vi.mock('@/games/_shared/useGameSocket', () => {
  const impl = (_gameType, options = {}) => {
    capturedEvents = (options && options.events) || {};
    return {
      socket: null,
      status: socketStatusValue,
      lastError: null,
      serverSeedHash: null,
      emit: emitMock,
    };
  };
  return { __esModule: true, default: impl, useGameSocket: impl };
});

import useBlackjackHand from '@/games/blackjack/useBlackjackHand';

const renderUseHand = (deps = {}) => {
  const play = deps.play || vi.fn();
  const burst = deps.burst || vi.fn();
  const announce = deps.announce || vi.fn();
  const utils = renderHook(() => useBlackjackHand({ play, burst, announce }));
  return { ...utils, play, burst, announce };
};

beforeEach(() => {
  emitMock.mockClear();
  capturedEvents = {};
  socketStatusValue = 'connected';
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useBlackjackHand — initial state', () => {
  it('starts in betting phase with zeroed hand state', () => {
    const { result } = renderUseHand();

    expect(result.current.phase).toBe('betting');
    expect(result.current.playerHand).toEqual([]);
    expect(result.current.dealerHand).toEqual([]);
    expect(result.current.activeBet).toBe(0);
    expect(result.current.canDouble).toBe(false);
    expect(result.current.result).toBe(null);
    expect(result.current.winAmount).toBe(0);
    expect(result.current.gameId).toBe(null);
    expect(result.current.errorMsg).toBe(null);
    expect(result.current.history).toEqual([]);
    expect(result.current.serverPlayerScore).toBe(null);
    expect(result.current.playerScoreDisplay).toBe(null);
  });

  it('exposes the documented action handler surface', () => {
    const { result } = renderUseHand();
    expect(typeof result.current.deal).toBe('function');
    expect(typeof result.current.hit).toBe('function');
    expect(typeof result.current.stand).toBe('function');
    expect(typeof result.current.doubleDown).toBe('function');
    expect(typeof result.current.newHand).toBe('function');
    expect(typeof result.current.setBetAmount).toBe('function');
  });

  it('wires blackjack_game_state and blackjack_error into useGameSocket events', () => {
    renderUseHand();
    expect(typeof capturedEvents.blackjack_game_state).toBe('function');
    expect(typeof capturedEvents.blackjack_error).toBe('function');
    expect(typeof capturedEvents.gameState).toBe('function');
  });
});

describe('useBlackjackHand — phase transitions', () => {
  it('deal() transitions betting -> active and emits blackjack_start', () => {
    const { result, play } = renderUseHand();

    act(() => result.current.setBetAmount(25));
    act(() => result.current.deal());

    expect(result.current.phase).toBe('active');
    expect(result.current.activeBet).toBe(25);
    expect(emitMock).toHaveBeenCalledWith('blackjack_start', { betAmount: 25 });
    expect(play).toHaveBeenCalledWith('chip-drop');
  });

  it('deal() is a no-op while a hand is already active', () => {
    const { result } = renderUseHand();
    act(() => result.current.setBetAmount(5));
    act(() => result.current.deal());
    emitMock.mockClear();

    act(() => result.current.deal());
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('deal() is a no-op when betAmount is below MIN_BET', () => {
    const { result } = renderUseHand();
    act(() => result.current.setBetAmount(0));
    act(() => result.current.deal());

    expect(result.current.phase).toBe('betting');
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('blackjack_game_state with status="active" populates hands and sets active phase', () => {
    const { result, announce } = renderUseHand();

    act(() =>
      capturedEvents.blackjack_game_state({
        gameId: 'bj_A',
        playerHand: [
          { rank: 'A', suit: 'hearts' },
          { rank: '7', suit: 'spades' },
        ],
        dealerHand: [{ rank: 'K', suit: 'clubs' }],
        playerScore: 18,
        betAmount: 10,
        status: 'active',
        canDouble: true,
      }),
    );

    expect(result.current.phase).toBe('active');
    expect(result.current.gameId).toBe('bj_A');
    expect(result.current.playerHand).toHaveLength(2);
    expect(result.current.dealerHand).toHaveLength(1);
    expect(result.current.activeBet).toBe(10);
    expect(result.current.canDouble).toBe(true);
    expect(result.current.serverPlayerScore).toBe(18);
    expect(result.current.playerScoreDisplay).toBe('18');
    // Announces the player's newest card.
    expect(announce).toHaveBeenCalled();
  });

  it('blackjack_game_state with status="completed" (win) triggers burst + cashout sound', () => {
    const { result, play, burst, announce } = renderUseHand();

    act(() =>
      capturedEvents.blackjack_game_state({
        gameId: 'bj_W',
        playerHand: [
          { rank: 'A', suit: 'hearts' },
          { rank: 'K', suit: 'spades' },
        ],
        dealerHand: [
          { rank: '10', suit: 'clubs' },
          { rank: '9', suit: 'clubs' },
        ],
        playerScore: 21,
        betAmount: 10,
        status: 'completed',
        result: 'player_win',
        winAmount: 20,
      }),
    );

    expect(result.current.phase).toBe('completed');
    expect(result.current.result).toBe('player_win');
    expect(result.current.winAmount).toBe(20);
    expect(play).toHaveBeenCalledWith('cashout');
    expect(burst).toHaveBeenCalledWith({ multiplier: 2, amount: 20 });
    expect(announce).toHaveBeenCalled();
    // History records the completed hand.
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]).toMatchObject({
      id: 'bj_W',
      result: 'player_win',
      winAmount: 20,
      betAmount: 10,
    });
  });

  it('blackjack_game_state with status="completed" (loss) plays lose sound, no burst', () => {
    const { result, play, burst } = renderUseHand();
    act(() =>
      capturedEvents.blackjack_game_state({
        gameId: 'bj_L',
        playerHand: [{ rank: 'K', suit: 'hearts' }, { rank: '7', suit: 'spades' }],
        dealerHand: [{ rank: 'K', suit: 'clubs' }, { rank: 'Q', suit: 'clubs' }],
        playerScore: 17,
        betAmount: 10,
        status: 'completed',
        result: 'dealer_win',
        winAmount: 0,
      }),
    );

    expect(result.current.phase).toBe('completed');
    expect(result.current.result).toBe('dealer_win');
    expect(play).toHaveBeenCalledWith('lose');
    expect(burst).not.toHaveBeenCalled();
  });

  it('completed -> newHand() resets back to betting with cleared state', () => {
    const { result } = renderUseHand();
    act(() =>
      capturedEvents.blackjack_game_state({
        gameId: 'bj_N',
        playerHand: [{ rank: 'A', suit: 'hearts' }, { rank: 'K', suit: 'spades' }],
        dealerHand: [{ rank: '10', suit: 'clubs' }],
        playerScore: 21,
        betAmount: 5,
        status: 'completed',
        result: 'player_win',
        winAmount: 10,
      }),
    );
    expect(result.current.phase).toBe('completed');

    act(() => result.current.newHand());
    expect(result.current.phase).toBe('betting');
    expect(result.current.playerHand).toEqual([]);
    expect(result.current.dealerHand).toEqual([]);
    expect(result.current.activeBet).toBe(0);
    expect(result.current.canDouble).toBe(false);
    expect(result.current.result).toBe(null);
    expect(result.current.winAmount).toBe(0);
    expect(result.current.gameId).toBe(null);
  });

  it('does not double-record the same completed gameId in history', () => {
    const { result } = renderUseHand();
    const completed = {
      gameId: 'dupe',
      playerHand: [{ rank: 'A', suit: 'hearts' }, { rank: 'K', suit: 'spades' }],
      dealerHand: [{ rank: '10', suit: 'clubs' }],
      playerScore: 21,
      betAmount: 5,
      status: 'completed',
      result: 'player_win',
      winAmount: 10,
    };
    act(() => capturedEvents.blackjack_game_state(completed));
    act(() => capturedEvents.blackjack_game_state(completed));
    expect(result.current.history).toHaveLength(1);
  });
});

describe('useBlackjackHand — action handlers', () => {
  const enterActive = (result, overrides = {}) => {
    act(() =>
      capturedEvents.blackjack_game_state({
        gameId: 'bj_act',
        playerHand: [{ rank: '5', suit: 'hearts' }, { rank: '6', suit: 'spades' }],
        dealerHand: [{ rank: 'K', suit: 'clubs' }],
        playerScore: 11,
        betAmount: 10,
        status: 'active',
        canDouble: true,
        ...overrides,
      }),
    );
    expect(result.current.phase).toBe('active');
  };

  it('hit() emits blackjack_hit only while active', () => {
    const { result } = renderUseHand();

    // betting -> no-op
    act(() => result.current.hit());
    expect(emitMock).not.toHaveBeenCalled();

    enterActive(result);
    emitMock.mockClear();
    act(() => result.current.hit());
    expect(emitMock).toHaveBeenCalledWith('blackjack_hit', {});
  });

  it('stand() emits blackjack_stand only while active', () => {
    const { result } = renderUseHand();
    act(() => result.current.stand());
    expect(emitMock).not.toHaveBeenCalled();

    enterActive(result);
    emitMock.mockClear();
    act(() => result.current.stand());
    expect(emitMock).toHaveBeenCalledWith('blackjack_stand', {});
  });

  it('doubleDown() emits blackjack_double when canDouble is true', () => {
    const { result } = renderUseHand();
    enterActive(result, { canDouble: true });
    emitMock.mockClear();
    act(() => result.current.doubleDown());
    expect(emitMock).toHaveBeenCalledWith('blackjack_double', {});
  });

  it('doubleDown() is a no-op when canDouble is false', () => {
    const { result } = renderUseHand();
    enterActive(result, { canDouble: false });
    emitMock.mockClear();
    act(() => result.current.doubleDown());
    expect(emitMock).not.toHaveBeenCalled();
  });

  it('blackjack_error sets errorMsg and announces it', () => {
    const { result, announce } = renderUseHand();
    act(() =>
      capturedEvents.blackjack_error({ message: 'Insufficient balance' }),
    );
    expect(result.current.errorMsg).toBe('Insufficient balance');
    expect(announce).toHaveBeenCalledWith('Insufficient balance');
  });
});

describe('useBlackjackHand — keyboard shortcuts', () => {
  const enterActive = () =>
    act(() =>
      capturedEvents.blackjack_game_state({
        gameId: 'bj_kb',
        playerHand: [{ rank: '5', suit: 'hearts' }, { rank: '6', suit: 'spades' }],
        dealerHand: [{ rank: 'K', suit: 'clubs' }],
        playerScore: 11,
        betAmount: 10,
        status: 'active',
        canDouble: true,
      }),
    );

  it('binds H/S/D only while phase is active', () => {
    const { result } = renderUseHand();

    // Not active yet — keys do nothing.
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    });
    expect(emitMock).not.toHaveBeenCalled();

    enterActive();
    emitMock.mockClear();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h' }));
    });
    expect(emitMock).toHaveBeenCalledWith('blackjack_hit', {});

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    });
    expect(emitMock).toHaveBeenCalledWith('blackjack_stand', {});

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    });
    expect(emitMock).toHaveBeenCalledWith('blackjack_double', {});

    // Ensure consumer used result for active assertions.
    expect(result.current.phase).toBe('active');
  });

  it('ignores keyboard shortcuts when modifier keys are pressed', () => {
    renderUseHand();
    enterActive();
    emitMock.mockClear();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'h', ctrlKey: true }),
      );
    });
    expect(emitMock).not.toHaveBeenCalled();
  });
});

describe('useBlackjackHand — cleanup on unmount', () => {
  it('removes the keydown listener when unmounted from the active phase', () => {
    const { result, unmount } = renderUseHand();
    act(() =>
      capturedEvents.blackjack_game_state({
        gameId: 'bj_un',
        playerHand: [{ rank: '5', suit: 'hearts' }, { rank: '6', suit: 'spades' }],
        dealerHand: [{ rank: 'K', suit: 'clubs' }],
        playerScore: 11,
        betAmount: 10,
        status: 'active',
        canDouble: true,
      }),
    );
    expect(result.current.phase).toBe('active');

    const removeSpy = vi.spyOn(window, 'removeEventListener');
    unmount();

    const removed = removeSpy.mock.calls.some(([type]) => type === 'keydown');
    expect(removed).toBe(true);
    removeSpy.mockRestore();
  });
});
