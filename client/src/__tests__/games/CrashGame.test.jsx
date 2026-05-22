import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Hoisted mocks --------------------------------------------------------------
const { handlers, emitSpy, ackByEvent, navigateMock, toastError, playSpy, stopAmbientSpy } =
  vi.hoisted(() => ({
    handlers: {},
    emitSpy: vi.fn(),
    ackByEvent: {},
    navigateMock: vi.fn(),
    toastError: vi.fn(),
    playSpy: vi.fn(),
    stopAmbientSpy: vi.fn(),
  }));

// Mock the shared socket hook — capture the `events` map handed in, and the
// emit calls so we can drive acks from tests.
vi.mock('@/games/_shared/useGameSocket', () => ({
  default: (_gameType, opts) => {
    Object.assign(handlers, opts?.events || {});
    return {
      socket: {},
      status: 'connected',
      lastError: null,
      serverSeedHash: 'hash-abc',
      emit: emitSpy,
    };
  },
  useGameSocket: (_gameType, opts) => {
    Object.assign(handlers, opts?.events || {});
    return {
      socket: {},
      status: 'connected',
      lastError: null,
      serverSeedHash: 'hash-abc',
      emit: emitSpy,
    };
  },
}));

vi.mock('@/components/casino/GameShell', () => ({
  default: ({ children, panel, stats }) => (
    <div>
      <div data-testid="layout-canvas">{children}</div>
      <div data-testid="layout-controls">{panel}</div>
      <div data-testid="layout-stats">{stats}</div>
    </div>
  ),
}));

vi.mock('@/components/casino/BetPanel', () => ({
  default: ({ onPlaceBet, disabled, betLabel, extra }) => (
    <div data-testid="bet-controls">
      {/* Both testids fire the same primary action — the component flips its
          internal label/role between place-bet and cash-out based on phase. */}
      <button data-testid="place-bet" onClick={onPlaceBet} disabled={disabled}>
        {betLabel || 'Place'}
      </button>
      <button data-testid="cash-out" onClick={onPlaceBet} disabled={disabled}>
        {betLabel || 'Cash'}
      </button>
      {extra}
    </div>
  ),
}));

vi.mock('@/components/casino/WinBurst', () => ({
  useWinBurst: () => ({ burst: vi.fn(), WinBurst: () => null }),
}));

vi.mock('@/components/casino/SoundProvider', () => ({
  useSound: () => ({ play: vi.fn(), mute: false, muted: false, setMute: vi.fn() }),
}));

vi.mock('@/components/casino/MotionSafe', () => ({
  useReducedMotion: () => false,
  MotionSafe: ({ children }) => <div>{children}</div>,
}));

// CrashCurve uses gsap/framer-motion heavily — render a lightweight stub so
// jsdom isn't asked to drive the ticker.
vi.mock('@/games/crash/CrashCurve', () => ({
  default: ({ phase }) => <div data-testid="game-canvas" aria-label="Crash multiplier chart" data-phase={phase} />,
}));

vi.mock('@/games/_shared/ProvablyFairPanel', () => ({
  default: () => <div data-testid="pf-panel" />,
}));

vi.mock('@/games/_shared/DisconnectOverlay', () => ({
  default: ({ status }) => (status === 'connected' ? null : <div data-testid="disconnect" />),
}));

vi.mock('@/games/crash/CrashHistory', () => ({ default: () => <div data-testid="crash-history" /> }));
vi.mock('@/games/crash/CrashPlayersList', () => ({ default: () => <div data-testid="crash-players" /> }));
vi.mock('@/games/crash/CrashActiveBets', () => ({ default: () => <div data-testid="crash-active-bets" /> }));

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: React.createContext({
    user: { id: 1, username: 'tester', balance: 1000, avatar: 'a' },
    isAuthenticated: true,
    loading: false,
    updateBalance: vi.fn(),
  }),
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: toastError, info: vi.fn(), warning: vi.fn() }),
}));

vi.mock('@/contexts/AudioContext', () => ({
  useAudio: () => ({
    play: playSpy,
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

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

import CrashGame from '@/games/crash/CrashGame';
import { AuthContext } from '@/contexts/AuthContext';

const renderGame = (ctxOverride = {}) => {
  const ctxValue = {
    user: { id: 1, username: 'tester', balance: 1000, avatar: 'a' },
    isAuthenticated: true,
    loading: false,
    updateBalance: vi.fn(),
    ...ctxOverride,
  };
  return {
    ...render(
      <AuthContext.Provider value={ctxValue}>
        <MemoryRouter>
          <CrashGame />
        </MemoryRouter>
      </AuthContext.Provider>,
    ),
    ctxValue,
  };
};

emitSpy.mockImplementation((event, _payload, ack) => {
  const resp = ackByEvent[event];
  if (ack && resp) ack(resp);
});

describe('CrashGame (shared shell)', () => {
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

  it('renders the bet controls inside the shared layout', () => {
    renderGame();
    expect(screen.getByTestId('bet-controls')).toBeInTheDocument();
    expect(screen.getByTestId('layout-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('crash-history')).toBeInTheDocument();
    expect(screen.getByTestId('crash-active-bets')).toBeInTheDocument();
    expect(screen.getByTestId('pf-panel')).toBeInTheDocument();
  });

  it('redirects to login when unauthenticated and not loading', () => {
    renderGame({ isAuthenticated: false, loading: false, user: null });
    expect(navigateMock).toHaveBeenCalledWith('/login', expect.objectContaining({ state: expect.any(Object) }));
  });

  it('does not redirect while auth is still loading', () => {
    renderGame({ isAuthenticated: false, loading: true, user: null });
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('moves through phases via socket handlers (waiting/running/crashed)', () => {
    renderGame();
    act(() => handlers.gameState({ isGameRunning: false, isGameStarting: true, currentMultiplier: 1 }));
    act(() => handlers.gameStarting({ startingIn: 5 }));
    act(() => handlers.gameStarted());
    act(() => handlers.multiplierUpdate({ multiplier: 1.5 }));
    act(() => handlers.gameCrashed({ crashPoint: 2.5 }));
  });

  it('places a bet via emit and reflects placed status', () => {
    ackByEvent.placeBet = { success: true, sessionId: 'sess-1', balance: 999 };
    renderGame();
    act(() => handlers.gameStarting({ startingIn: 5 }));
    fireEvent.click(screen.getByTestId('place-bet'));
    expect(emitSpy).toHaveBeenCalledWith(
      'placeBet',
      expect.objectContaining({ amount: 1 }),
      expect.any(Function),
    );
    expect(playSpy.mock.calls.map((c) => c[0])).toContain('bet');
  });

  it('toasts on bet rejection and resets status', () => {
    ackByEvent.placeBet = { success: false, error: 'insufficient_funds' };
    renderGame();
    act(() => handlers.gameStarting({ startingIn: 5 }));
    fireEvent.click(screen.getByTestId('place-bet'));
    expect(toastError).toHaveBeenCalledWith('insufficient_funds');
  });

  it('cashes out via emit when running and bet placed', () => {
    ackByEvent.placeBet = { success: true, sessionId: 'sess-1', balance: 999 };
    ackByEvent.cashOut = { success: true, finalMultiplier: 3, resultDetails: { profit: 2 } };
    renderGame();
    act(() => handlers.gameStarting({ startingIn: 5 }));
    fireEvent.click(screen.getByTestId('place-bet'));
    act(() => handlers.gameStarted());
    act(() => handlers.multiplierUpdate({ multiplier: 3 }));
    fireEvent.click(screen.getByTestId('cash-out'));
    expect(emitSpy).toHaveBeenCalledWith('cashOut', {}, expect.any(Function));
    expect(playSpy.mock.calls.map((c) => c[0])).toContain('win');
  });

  it('big win when profit > 5x bet', () => {
    ackByEvent.placeBet = { success: true };
    ackByEvent.cashOut = { success: true, finalMultiplier: 50, resultDetails: { profit: 100 } };
    renderGame();
    act(() => handlers.gameStarting({ startingIn: 5 }));
    fireEvent.click(screen.getByTestId('place-bet'));
    act(() => handlers.gameStarted());
    fireEvent.click(screen.getByTestId('cash-out'));
    expect(playSpy.mock.calls.map((c) => c[0])).toContain('big_win');
  });

  it('reverts status and toasts on cashout rejection', () => {
    ackByEvent.placeBet = { success: true };
    ackByEvent.cashOut = { success: false, error: 'too late' };
    renderGame();
    act(() => handlers.gameStarting({ startingIn: 5 }));
    fireEvent.click(screen.getByTestId('place-bet'));
    act(() => handlers.gameStarted());
    fireEvent.click(screen.getByTestId('cash-out'));
    expect(toastError).toHaveBeenCalledWith('too late');
  });

  it('handles autoCashoutSuccess server event', () => {
    renderGame();
    act(() => handlers.gameStarting({ startingIn: 5 }));
    act(() => handlers.autoCashoutSuccess({ multiplier: 2, winAmount: 2, profit: 1 }));
    expect(playSpy.mock.calls.map((c) => c[0])).toContain('win');
  });

  it('handles betLost server event after a placed bet', () => {
    ackByEvent.placeBet = { success: true };
    renderGame();
    act(() => handlers.gameStarting({ startingIn: 5 }));
    fireEvent.click(screen.getByTestId('place-bet'));
    act(() => handlers.gameStarted());
    act(() => handlers.betLost({ amount: 1, gameId: 'g1' }));
    expect(playSpy.mock.calls.map((c) => c[0])).toContain('loss');
  });

  it('falls back to LOSS on gameCrashed when bet is still placed', () => {
    ackByEvent.placeBet = { success: true };
    renderGame();
    act(() => handlers.gameStarting({ startingIn: 5 }));
    fireEvent.click(screen.getByTestId('place-bet'));
    act(() => handlers.gameStarted());
    act(() => handlers.gameCrashed({ crashPoint: 1.2 }));
    expect(playSpy.mock.calls.map((c) => c[0])).toContain('loss');
  });

  it('appends roundComplete entries into provably-fair history', () => {
    renderGame();
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
  });

  it('updates active players and bets from socket events', () => {
    renderGame();
    act(() => handlers.activePlayers([{ id: 'p1', username: 'p' }]));
    act(() => handlers.playerJoined({ id: 'p2', username: 'q' }));
    act(() => handlers.playerLeft({ id: 'p1' }));
    act(() => handlers.currentBets([{ userId: 1, username: 't', amount: 5 }]));
    act(() => handlers.playerBet({ userId: 2, username: 'u', amount: 10 }));
    act(() => handlers.playerBet({ userId: 2, username: 'u', amount: 20 }));
    act(() => handlers.playerCashout({ userId: 2, multiplier: 2, profit: 10 }));
  });

  it('forwards server error events as toasts', () => {
    renderGame();
    act(() => handlers.error({ code: 'rate_limited' }));
    expect(toastError).toHaveBeenCalledWith('rate_limited');
  });

  it('Space key triggers cashout while running and bet placed', () => {
    ackByEvent.placeBet = { success: true };
    ackByEvent.cashOut = { success: true, finalMultiplier: 2, resultDetails: { profit: 1 } };
    renderGame();
    act(() => handlers.gameStarting({ startingIn: 5 }));
    fireEvent.click(screen.getByTestId('place-bet'));
    act(() => handlers.gameStarted());
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    });
    expect(emitSpy).toHaveBeenCalledWith('cashOut', {}, expect.any(Function));
  });

  it('ingests gameHistory in newest-first order', () => {
    renderGame();
    act(() =>
      handlers.gameHistory([
        { gameId: '1', crashPoint: 1.5, timestamp: 1 },
        { gameId: '2', crashPoint: 2.5, timestamp: 2 },
      ]),
    );
  });
});
