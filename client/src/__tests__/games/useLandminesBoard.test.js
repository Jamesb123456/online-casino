import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Hoisted socket spy — captures every emit call so we can replay acks.
const { emitSpy, lastEmits } = vi.hoisted(() => {
  const lastEmits = [];
  const emitSpy = vi.fn((event, payload, ack) => {
    lastEmits.push({ event, payload, ack });
  });
  return { emitSpy, lastEmits };
});

vi.mock('@/games/_shared/useGameSocket', () => {
  const hook = () => ({
    emit: emitSpy,
    status: 'connected',
    lastError: null,
    serverSeedHash: 'hash-test',
    socket: null,
  });
  return { __esModule: true, default: hook, useGameSocket: hook };
});

import useLandminesBoard, {
  CELL_HIDDEN,
  CELL_SAFE,
  CELL_MINE,
  DEFAULT_BET,
  DEFAULT_MINES,
  GRID_SIZE,
  HISTORY_LIMIT,
} from '@/games/landmines/useLandminesBoard';

const lastAckFor = (event) => {
  const entries = lastEmits.filter((e) => e.event === event);
  return entries[entries.length - 1]?.ack;
};

const startRound = (result) => {
  act(() => {
    result.current.startGame();
  });
  act(() => {
    lastAckFor('landmines:start')({
      success: true,
      gameId: 'g1',
      mines: DEFAULT_MINES,
      gridSize: GRID_SIZE,
      balance: 990,
    });
  });
};

describe('useLandminesBoard', () => {
  beforeEach(() => {
    emitSpy.mockClear();
    lastEmits.length = 0;
  });

  it('returns sensible initial state (phase=waiting, empty 5x5 board)', () => {
    const { result } = renderHook(() => useLandminesBoard());

    expect(result.current.isGameActive).toBe(false);
    expect(result.current.isPending).toBe(false);
    expect(result.current.result).toBeNull();
    expect(result.current.errorMsg).toBeNull();
    expect(result.current.history).toEqual([]);
    expect(result.current.betAmount).toBe(DEFAULT_BET);
    expect(result.current.mines).toBe(DEFAULT_MINES);
    expect(result.current.currentMultiplier).toBe(1);
    expect(result.current.potentialWin).toBe(0);
    expect(result.current.focusedCell).toEqual({ row: 0, col: 0 });

    expect(result.current.board).toHaveLength(GRID_SIZE);
    expect(result.current.board[0]).toHaveLength(GRID_SIZE);
    expect(result.current.board[0][0]).toEqual({ state: CELL_HIDDEN, multiplier: null });
  });

  it('transitions waiting -> playing on a successful start ack', () => {
    const { result } = renderHook(() => useLandminesBoard());

    act(() => {
      result.current.startGame();
    });
    // Mid-flight: pending and not yet active.
    expect(result.current.isPending).toBe(true);
    expect(result.current.isGameActive).toBe(false);

    const startCall = lastEmits.find((e) => e.event === 'landmines:start');
    expect(startCall).toBeTruthy();
    expect(startCall.payload).toEqual({ betAmount: DEFAULT_BET, mines: DEFAULT_MINES });
    expect(typeof startCall.ack).toBe('function');

    act(() => {
      startCall.ack({ success: true, gameId: 'g1', mines: DEFAULT_MINES, gridSize: GRID_SIZE });
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isGameActive).toBe(true);
    expect(result.current.errorMsg).toBeNull();
  });

  it('records errorMsg and stays in waiting when start fails', () => {
    const { result } = renderHook(() => useLandminesBoard());

    act(() => {
      result.current.startGame();
    });
    act(() => {
      lastAckFor('landmines:start')({ success: false, error: 'invalid_bet' });
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.isGameActive).toBe(false);
    expect(result.current.errorMsg).toBe('invalid_bet');
  });

  it('handleReveal emits landmines:pick and marks safe tiles', () => {
    const { result } = renderHook(() => useLandminesBoard());
    startRound(result);

    act(() => {
      result.current.handleReveal(0, 0);
    });
    const pickCall = lastEmits.find((e) => e.event === 'landmines:pick');
    expect(pickCall.payload).toEqual({ row: 0, col: 0 });

    act(() => {
      pickCall.ack({
        success: true,
        hit: false,
        position: '0,0',
        multiplier: 1.34,
        potentialWin: 13.4,
        gameOver: false,
      });
    });

    expect(result.current.board[0][0]).toEqual({ state: CELL_SAFE, multiplier: 1.34 });
    expect(result.current.currentMultiplier).toBeCloseTo(1.34);
    expect(result.current.potentialWin).toBeCloseTo(13.4);
    expect(result.current.isGameActive).toBe(true);
  });

  it('handleReveal on a mine ends the round and pushes a loss to history', () => {
    const { result } = renderHook(() => useLandminesBoard());
    startRound(result);

    act(() => {
      result.current.handleReveal(1, 0);
    });
    act(() => {
      lastAckFor('landmines:pick')({
        success: true,
        hit: true,
        position: '1,0',
        gameOver: true,
        fullGrid: [
          [false, false, false, false, false],
          [true, false, false, false, false],
          [false, false, true, false, false],
          [false, false, false, false, false],
          [false, false, false, false, true],
        ],
        winAmount: 0,
      });
    });

    expect(result.current.isGameActive).toBe(false);
    expect(result.current.result).toMatchObject({ win: false, message: 'Mine hit' });
    expect(result.current.board[1][0].state).toBe(CELL_MINE);
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]).toMatchObject({ win: false, multiplier: 0 });
  });

  it('handleCashout emits landmines:cashout and ends the round on success', () => {
    const { result } = renderHook(() => useLandminesBoard());
    startRound(result);

    // Reveal one safe tile to give the cashout something to celebrate.
    act(() => {
      result.current.handleReveal(0, 0);
    });
    act(() => {
      lastAckFor('landmines:pick')({
        success: true,
        hit: false,
        multiplier: 1.34,
        potentialWin: 13.4,
        gameOver: false,
      });
    });

    act(() => {
      result.current.handleCashout();
    });
    const cashoutCall = lastEmits.find((e) => e.event === 'landmines:cashout');
    expect(cashoutCall).toBeTruthy();
    expect(cashoutCall.payload).toEqual({});

    act(() => {
      cashoutCall.ack({
        success: true,
        winAmount: 50,
        multiplier: 1.34,
        profit: 40,
        balance: 1040,
      });
    });

    expect(result.current.isGameActive).toBe(false);
    expect(result.current.result).toMatchObject({
      win: true,
      message: 'Cashed out',
      amount: 50,
      profit: 40,
    });
    expect(result.current.history[0]).toMatchObject({ win: true, profit: 40 });
  });

  it('treats gameOver on a safe reveal as auto-cashout', () => {
    const { result } = renderHook(() => useLandminesBoard());
    startRound(result);

    act(() => {
      result.current.handleReveal(0, 0);
    });
    act(() => {
      lastAckFor('landmines:pick')({
        success: true,
        hit: false,
        multiplier: 20,
        potentialWin: 200,
        winAmount: 200,
        profit: 190,
        gameOver: true,
      });
    });

    expect(result.current.isGameActive).toBe(false);
    expect(result.current.result).toMatchObject({
      win: true,
      message: 'All safe tiles revealed',
      amount: 200,
      profit: 190,
    });
    expect(result.current.history[0]).toMatchObject({ win: true, auto: true });
  });

  it('dismissResult clears the post-round result panel', () => {
    const { result } = renderHook(() => useLandminesBoard());
    startRound(result);

    act(() => {
      result.current.handleCashout();
    });
    act(() => {
      lastAckFor('landmines:cashout')({
        success: true,
        winAmount: 10,
        multiplier: 1,
        profit: 0,
      });
    });
    expect(result.current.result).not.toBeNull();

    act(() => {
      result.current.dismissResult();
    });
    expect(result.current.result).toBeNull();
  });

  it('handleCellKeyDown moves focusedCell within grid bounds and triggers reveal', () => {
    const { result } = renderHook(() => useLandminesBoard());
    startRound(result);

    const makeEvent = (key) => ({ key, preventDefault: vi.fn() });

    act(() => {
      result.current.handleCellKeyDown(makeEvent('ArrowRight'), 0, 0);
    });
    expect(result.current.focusedCell).toEqual({ row: 0, col: 1 });

    act(() => {
      result.current.handleCellKeyDown(makeEvent('ArrowDown'), 0, 1);
    });
    expect(result.current.focusedCell).toEqual({ row: 1, col: 1 });

    // Edge clamp: ArrowLeft at col=0 stays put.
    act(() => {
      result.current.handleCellKeyDown(makeEvent('ArrowLeft'), 1, 0);
    });
    expect(result.current.focusedCell).toEqual({ row: 1, col: 1 });

    // Enter triggers a reveal emit.
    act(() => {
      result.current.handleCellKeyDown(makeEvent('Enter'), 2, 2);
    });
    const pickCall = lastEmits.find((e) => e.event === 'landmines:pick');
    expect(pickCall.payload).toEqual({ row: 2, col: 2 });
  });

  it('handleFocusCell updates the tracked focused cell', () => {
    const { result } = renderHook(() => useLandminesBoard());
    act(() => {
      result.current.handleFocusCell(3, 4);
    });
    expect(result.current.focusedCell).toEqual({ row: 3, col: 4 });
  });

  it('invokes injected play and burst side-effects on cashout', () => {
    const play = vi.fn();
    const burst = vi.fn();
    const { result } = renderHook(() => useLandminesBoard({ play, burst }));

    startRound(result);
    expect(play).toHaveBeenCalledWith('bet');

    act(() => {
      result.current.handleCashout();
    });
    act(() => {
      lastAckFor('landmines:cashout')({
        success: true,
        winAmount: 25,
        multiplier: 2.5,
        profit: 15,
      });
    });

    expect(play).toHaveBeenCalledWith('cashout');
    expect(burst).toHaveBeenCalledWith({ multiplier: 2.5, amount: 25 });
  });

  it('caps history length at HISTORY_LIMIT', () => {
    const { result } = renderHook(() => useLandminesBoard());

    for (let i = 0; i < HISTORY_LIMIT + 3; i += 1) {
      // Restart + mine-hit to grow history quickly without juggling tile state.
      act(() => {
        result.current.startGame();
      });
      act(() => {
        lastAckFor('landmines:start')({
          success: true,
          gameId: `g${i}`,
          mines: DEFAULT_MINES,
          gridSize: GRID_SIZE,
        });
      });
      act(() => {
        result.current.handleReveal(0, 0);
      });
      act(() => {
        lastAckFor('landmines:pick')({
          success: true,
          hit: true,
          position: '0,0',
          gameOver: true,
          fullGrid: null,
          winAmount: 0,
        });
      });
    }

    expect(result.current.history.length).toBeLessThanOrEqual(HISTORY_LIMIT);
  });

  it('unmounts cleanly without throwing', () => {
    const { result, unmount } = renderHook(() => useLandminesBoard());
    startRound(result);
    expect(() => unmount()).not.toThrow();
  });
});
