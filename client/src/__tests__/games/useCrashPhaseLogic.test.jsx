/**
 * useCrashPhaseLogic — unit tests.
 *
 * Locks the state-machine behavior we extracted from CrashGame.jsx:
 *   - initial state
 *   - phase transitions under each socket event
 *   - placeBet / cashOut handlers + ack handling
 *   - cleanup on unmount (listeners + intervals)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';

// Hoisted shared spies / handler bag --------------------------------------
const {
  handlers,
  emitSpy,
  ackByEvent,
  toastError,
  toastSuccess,
  playLegacySpy,
  playFxSpy,
  stopAmbientSpy,
  announceSpy,
  burstSpy,
} = vi.hoisted(() => ({
  handlers: {},
  emitSpy: vi.fn(),
  ackByEvent: {},
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  playLegacySpy: vi.fn(),
  playFxSpy: vi.fn(),
  stopAmbientSpy: vi.fn(),
  announceSpy: vi.fn(),
  burstSpy: vi.fn(),
  removeEventListenerSpy: vi.fn(),
}));

vi.mock('@/games/_shared/useGameSocket', () => ({
  default: (_gameType, opts) => {
    Object.assign(handlers, opts?.events || {});
    return {
      socket: {},
      status: 'connected',
      lastError: null,
      serverSeedHash: 'hash-xyz',
      emit: emitSpy,
    };
  },
  useGameSocket: (_gameType, opts) => {
    Object.assign(handlers, opts?.events || {});
    return {
      socket: {},
      status: 'connected',
      lastError: null,
      serverSeedHash: 'hash-xyz',
      emit: emitSpy,
    };
  },
}));

vi.mock('@/components/casino/WinBurst', () => ({
  useWinBurst: () => ({ burst: burstSpy, WinBurst: () => null }),
}));

vi.mock('@/components/casino/SoundProvider', () => ({
  useSound: () => ({ play: playFxSpy, mute: false, muted: false, setMute: vi.fn() }),
}));

vi.mock('@/components/casino/MotionSafe', () => ({
  useReducedMotion: () => false,
  MotionSafe: ({ children }) => <div>{children}</div>,
}));

vi.mock('@/games/_shared/hooks/useAnnouncer', () => ({
  default: () => ({ announcement: '', announce: announceSpy, clear: vi.fn() }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: React.createContext({
    user: { id: 1, username: 'tester', balance: 1000, avatar: 'a' },
    isAuthenticated: true,
    loading: false,
    updateBalance: vi.fn(),
  }),
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ success: toastSuccess, error: toastError, info: vi.fn(), warning: vi.fn() }),
}));

vi.mock('@/contexts/AudioContext', () => ({
  useAudio: () => ({
    play: playLegacySpy,
    stop: vi.fn(),
    startAmbient: vi.fn(),
    stopAmbient: stopAmbientSpy,
    muted: false,
    volume: 0.5,
    setMuted: vi.fn(),
    setVolume: vi.fn(),
    SFX: {
      BET: 'bet',
      WIN: 'win',
      LOSS: 'loss',
      BIG_WIN: 'big_win',
      TICK: 'tick',
      DRUMROLL: 'drumroll',
      AMBIENT: 'ambient',
    },
  }),
}));

// Import after mocks are in place.
import useCrashPhaseLogic, { PHASE } from '@/games/crash/useCrashPhaseLogic';

emitSpy.mockImplementation((event, _payload, ack) => {
  const resp = ackByEvent[event];
  if (ack && resp) ack(resp);
});

const setup = () => renderHook(() => useCrashPhaseLogic());

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(handlers).forEach((k) => delete handlers[k]);
  Object.keys(ackByEvent).forEach((k) => delete ackByEvent[k]);
  emitSpy.mockImplementation((event, _payload, ack) => {
    const resp = ackByEvent[event];
    if (ack && resp) ack(resp);
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCrashPhaseLogic — initial state', () => {
  it('returns the documented contract', () => {
    const { result } = setup();
    expect(result.current).toEqual(
      expect.objectContaining({
        phase: PHASE.CONNECTING,
        currentMultiplier: 1.0,
        crashPoint: null,
        countdown: 0,
        history: [],
        players: [],
        activeBets: [],
        betAmount: 1,
        autoCashoutAt: 2.0,
        betStatus: 'idle',
        lastResult: null,
        clientSeed: '',
        pfHistory: [],
        shake: false,
        flash: null,
        canPlaceBet: false,
        canCashout: false,
        status: 'connected',
        serverSeedHash: 'hash-xyz',
      }),
    );
    expect(typeof result.current.placeBet).toBe('function');
    expect(typeof result.current.cashOut).toBe('function');
    expect(typeof result.current.setBetAmount).toBe('function');
    expect(typeof result.current.setAutoCashoutAt).toBe('function');
    expect(typeof result.current.setClientSeed).toBe('function');
    expect(typeof result.current.WinBurst).toBe('function');
  });

  it('stops the ambient track on mount', () => {
    setup();
    expect(stopAmbientSpy).toHaveBeenCalled();
  });
});

describe('useCrashPhaseLogic — phase transitions', () => {
  it('gameState(isGameRunning=false) → waiting', () => {
    const { result } = setup();
    act(() => handlers.gameState({ isGameRunning: false, currentMultiplier: 1 }));
    expect(result.current.phase).toBe(PHASE.WAITING);
  });

  it('gameState(isGameRunning=true) → running and copies multiplier', () => {
    const { result } = setup();
    act(() => handlers.gameState({ isGameRunning: true, currentMultiplier: 2.5 }));
    expect(result.current.phase).toBe(PHASE.RUNNING);
    expect(result.current.currentMultiplier).toBe(2.5);
  });

  it('gameStarting sets countdown, resets multiplier and crashPoint', () => {
    const { result } = setup();
    act(() => handlers.gameStarting({ startingIn: 5 }));
    expect(result.current.phase).toBe(PHASE.WAITING);
    expect(result.current.countdown).toBe(5);
    expect(result.current.currentMultiplier).toBe(1.0);
    expect(result.current.crashPoint).toBe(null);
  });

  it('gameStarted → running with multiplier reset to 1.0', () => {
    const { result } = setup();
    act(() => handlers.gameStarted());
    expect(result.current.phase).toBe(PHASE.RUNNING);
    expect(result.current.currentMultiplier).toBe(1.0);
  });

  it('multiplierUpdate updates currentMultiplier', () => {
    const { result } = setup();
    act(() => handlers.gameStarted());
    act(() => handlers.multiplierUpdate({ multiplier: 3.14 }));
    expect(result.current.currentMultiplier).toBe(3.14);
  });

  it('gameCrashed → crashed with crashPoint set and audio/announce fired', () => {
    const { result } = setup();
    act(() => handlers.gameStarted());
    act(() => handlers.gameCrashed({ crashPoint: 2.5 }));
    expect(result.current.phase).toBe(PHASE.CRASHED);
    expect(result.current.crashPoint).toBe(2.5);
    expect(result.current.currentMultiplier).toBe(2.5);
    expect(playFxSpy).toHaveBeenCalledWith('crash-bust');
    expect(announceSpy).toHaveBeenCalledWith('Crashed at 2.50x');
  });

  it('ingests gameHistory in newest-first order', () => {
    const { result } = setup();
    act(() =>
      handlers.gameHistory([
        { gameId: 'g1', crashPoint: 1.5, timestamp: 1 },
        { gameId: 'g2', crashPoint: 2.5, timestamp: 2 },
      ]),
    );
    expect(result.current.history).toHaveLength(2);
    expect(result.current.history[0].id).toBe('g2');
  });

  it('roundComplete appends to pfHistory (newest first)', () => {
    const { result } = setup();
    act(() =>
      handlers.roundComplete({
        roundId: 'r1',
        serverSeed: 's',
        serverSeedHash: 'h',
        clientSeed: 'c',
        nonce: 0,
        multiplier: 2.5,
      }),
    );
    expect(result.current.pfHistory).toHaveLength(1);
    expect(result.current.pfHistory[0].id).toBe('r1');
  });

  it('updates players and activeBets via socket events', () => {
    const { result } = setup();
    act(() => handlers.activePlayers([{ id: 'p1' }]));
    act(() => handlers.playerJoined({ id: 'p2' }));
    expect(result.current.players.map((p) => p.id)).toEqual(['p1', 'p2']);
    act(() => handlers.playerLeft({ id: 'p1' }));
    expect(result.current.players.map((p) => p.id)).toEqual(['p2']);

    act(() => handlers.currentBets([{ userId: 1, amount: 5 }]));
    expect(result.current.activeBets).toEqual([{ userId: 1, amount: 5 }]);
    act(() => handlers.playerBet({ userId: 2, amount: 10 }));
    act(() => handlers.playerBet({ userId: 2, amount: 20 }));
    expect(result.current.activeBets.find((b) => b.userId === 2).amount).toBe(20);
    act(() => handlers.playerCashout({ userId: 2, multiplier: 2, profit: 10 }));
    expect(result.current.activeBets.find((b) => b.userId === 2).cashedOut).toBe(true);
  });

  it('error handler forwards code to toast.error', () => {
    setup();
    act(() => handlers.error({ code: 'rate_limited' }));
    expect(toastError).toHaveBeenCalledWith('rate_limited');
  });
});

describe('useCrashPhaseLogic — handlers', () => {
  it('placeBet emits and reflects placed status on ack success', () => {
    ackByEvent.placeBet = { success: true };
    const { result } = setup();
    // Need to be in WAITING phase to satisfy canPlaceBet.
    act(() => handlers.gameStarting({ startingIn: 5 }));
    expect(result.current.canPlaceBet).toBe(true);
    act(() => result.current.placeBet());
    expect(emitSpy).toHaveBeenCalledWith(
      'placeBet',
      expect.objectContaining({ amount: 1, autoCashoutAt: 2.0 }),
      expect.any(Function),
    );
    expect(result.current.betStatus).toBe('placed');
    expect(playFxSpy.mock.calls.flat()).toContain('bet');
  });

  it('placeBet toasts and resets status on ack failure', () => {
    ackByEvent.placeBet = { success: false, error: 'insufficient_funds' };
    const { result } = setup();
    act(() => handlers.gameStarting({ startingIn: 5 }));
    act(() => result.current.placeBet());
    expect(toastError).toHaveBeenCalledWith('insufficient_funds');
    expect(result.current.betStatus).toBe('idle');
  });

  it('cashOut emits, updates status, plays win SFX', () => {
    ackByEvent.placeBet = { success: true };
    ackByEvent.cashOut = { success: true, finalMultiplier: 3, resultDetails: { profit: 2 } };
    const { result } = setup();
    act(() => handlers.gameStarting({ startingIn: 5 }));
    act(() => result.current.placeBet());
    act(() => handlers.gameStarted());
    expect(result.current.canCashout).toBe(true);
    act(() => result.current.cashOut());
    expect(emitSpy).toHaveBeenCalledWith('cashOut', {}, expect.any(Function));
    expect(result.current.betStatus).toBe('cashed_out');
    expect(playLegacySpy.mock.calls.flat()).toContain('win');
    expect(playFxSpy.mock.calls.flat()).toContain('cashout');
  });

  it('cashOut reverts to placed and toasts on ack failure', () => {
    ackByEvent.placeBet = { success: true };
    ackByEvent.cashOut = { success: false, error: 'too late' };
    const { result } = setup();
    act(() => handlers.gameStarting({ startingIn: 5 }));
    act(() => result.current.placeBet());
    act(() => handlers.gameStarted());
    act(() => result.current.cashOut());
    expect(toastError).toHaveBeenCalledWith('too late');
    expect(result.current.betStatus).toBe('placed');
  });

  it('autoCashoutSuccess flips to cashed_out and bursts', () => {
    const { result } = setup();
    act(() => handlers.gameStarting({ startingIn: 5 }));
    act(() => handlers.autoCashoutSuccess({ multiplier: 2, profit: 1 }));
    expect(result.current.betStatus).toBe('cashed_out');
    expect(burstSpy).toHaveBeenCalled();
    expect(playLegacySpy.mock.calls.flat()).toContain('win');
  });

  it('falls back to LOSS on gameCrashed when bet is still placed', () => {
    ackByEvent.placeBet = { success: true };
    const { result } = setup();
    act(() => handlers.gameStarting({ startingIn: 5 }));
    act(() => result.current.placeBet());
    act(() => handlers.gameStarted());
    act(() => handlers.gameCrashed({ crashPoint: 1.2 }));
    expect(result.current.betStatus).toBe('lost');
    expect(playLegacySpy.mock.calls.flat()).toContain('loss');
    expect(result.current.lastResult).toEqual(
      expect.objectContaining({ type: 'loss', crashPoint: 1.2, lost: 1 }),
    );
  });
});

describe('useCrashPhaseLogic — cleanup', () => {
  it('removes the spacebar keydown listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = setup();
    unmount();
    const removedKeydown = removeSpy.mock.calls.some(([evt]) => evt === 'keydown');
    expect(removedKeydown).toBe(true);
    removeSpy.mockRestore();
  });

  it('clears the per-tick interval when leaving the running phase', () => {
    vi.useFakeTimers();
    const clearSpy = vi.spyOn(window, 'clearInterval');
    const { unmount } = setup();
    act(() => handlers.gameStarted());
    // Advance some ticks to confirm we actually started the interval.
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(playLegacySpy.mock.calls.flat()).toContain('tick');
    // Leaving running phase should clear the interval.
    act(() => handlers.gameCrashed({ crashPoint: 1.2 }));
    expect(clearSpy).toHaveBeenCalled();
    unmount();
    clearSpy.mockRestore();
  });
});
