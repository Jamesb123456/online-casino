import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

/**
 * DiceGame is rebuilt on the shared shell (GameLayout / BetControls /
 * useGameSocket). Tests mock `useGameSocket` to capture outbound `dice:roll`
 * payloads and replay the ack callback synchronously.
 */
const { emitMock, playSpy, updateBalanceMock } = vi.hoisted(() => ({
  emitMock: vi.fn(),
  playSpy: vi.fn(),
  updateBalanceMock: vi.fn(),
}));

vi.mock('@/games/_shared/useGameSocket', () => ({
  __esModule: true,
  default: () => ({
    socket: null,
    status: 'connected',
    lastError: null,
    serverSeedHash: 'hash-abc',
    emit: emitMock,
  }),
  useGameSocket: () => ({
    socket: null,
    status: 'connected',
    lastError: null,
    serverSeedHash: 'hash-abc',
    emit: emitMock,
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  __esModule: true,
  default: () => ({
    user: { id: 1, username: 'tester', balance: 1000 },
    updateBalance: updateBalanceMock,
  }),
  useAuth: () => ({
    user: { id: 1, username: 'tester', balance: 1000 },
    updateBalance: updateBalanceMock,
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: React.createContext({
    user: { id: 1, username: 'tester', balance: 1000 },
    updateBalance: updateBalanceMock,
  }),
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

vi.mock('@/contexts/AudioContext', () => ({
  useAudio: () => ({
    play: playSpy,
    stop: vi.fn(),
    startAmbient: vi.fn(),
    stopAmbient: vi.fn(),
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

import DiceGame, { previewMultiplier, previewWinProb } from '@/games/dice/DiceGame';

const renderGame = () => render(
  <MemoryRouter>
    <DiceGame />
  </MemoryRouter>,
);

// Helper: pull out the `dice:roll` callback from the most recent emit.
const lastRollAck = () => {
  const rollCalls = emitMock.mock.calls.filter((c) => c[0] === 'dice:roll');
  const call = rollCalls[rollCalls.length - 1];
  return call ? call[2] : null;
};

const lastRollPayload = () => {
  const rollCalls = emitMock.mock.calls.filter((c) => c[0] === 'dice:roll');
  const call = rollCalls[rollCalls.length - 1];
  return call ? call[1] : null;
};

describe('DiceGame component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emitMock.mockReset();
    playSpy.mockClear();
    updateBalanceMock.mockClear();
  });

  it('renders the roll button', () => {
    renderGame();
    expect(screen.getByTestId('dice-roll-button')).toBeInTheDocument();
  });

  it('shows ~50% win chance and ~1.92x multiplier at default target 50 / under', () => {
    renderGame();
    expect(screen.getByTestId('dice-win-chance').textContent).toMatch(/50\.00%/);
    expect(screen.getByTestId('dice-multiplier').textContent).toMatch(/1\.92x/);
  });

  it('updates the displayed multiplier when target changes', () => {
    renderGame();
    const slider = screen.getByLabelText(/Target/i);
    fireEvent.change(slider, { target: { value: '10' } });
    expect(screen.getByTestId('dice-multiplier').textContent).toMatch(/9\.60x/);
    expect(screen.getByTestId('dice-win-chance').textContent).toMatch(/10\.00%/);
  });

  it('emits dice:roll with the configured target/direction on click', () => {
    renderGame();
    fireEvent.click(screen.getByTestId('dice-roll-button'));
    const payload = lastRollPayload();
    expect(payload).toMatchObject({ target: 50, direction: 'under' });
    expect(typeof lastRollAck()).toBe('function');
  });

  it('renders the resolved result after the server callback fires', () => {
    renderGame();
    fireEvent.click(screen.getByTestId('dice-roll-button'));
    act(() => {
      lastRollAck()({
        ok: true,
        gameId: 'abc',
        result: 25.50,
        target: 50,
        direction: 'under',
        win: true,
        multiplier: 1.92,
        winAmount: 19.2,
        newBalance: 1010,
      });
    });
    expect(screen.getByTestId('dice-result').textContent).toBe('25.50');
  });

  it('plays BET on click and WIN on win', () => {
    renderGame();
    fireEvent.click(screen.getByTestId('dice-roll-button'));
    act(() => {
      lastRollAck()({
        ok: true,
        gameId: 'w1',
        result: 25,
        target: 50,
        direction: 'under',
        win: true,
        multiplier: 1.92,
        winAmount: 19.2,
        newBalance: 1010,
      });
    });
    const calls = playSpy.mock.calls.map((c) => c[0]);
    expect(calls).toContain('bet');
    expect(calls).toContain('win');
  });

  it('plays LOSS on loss', () => {
    renderGame();
    fireEvent.click(screen.getByTestId('dice-roll-button'));
    act(() => {
      lastRollAck()({
        ok: true,
        gameId: 'l1',
        result: 75,
        target: 50,
        direction: 'under',
        win: false,
        multiplier: 1.92,
        winAmount: 0,
        newBalance: 990,
      });
    });
    const calls = playSpy.mock.calls.map((c) => c[0]);
    expect(calls).toContain('bet');
    expect(calls).toContain('loss');
  });

  it('renders a history row after a roll completes', () => {
    renderGame();
    fireEvent.click(screen.getByTestId('dice-roll-button'));
    act(() => {
      lastRollAck()({
        ok: true,
        gameId: 'h1',
        result: 50,
        target: 50,
        direction: 'under',
        win: false,
        multiplier: 1.92,
        winAmount: 0,
        newBalance: 990,
      });
    });
    expect(screen.queryByText(/No rolls yet/i)).not.toBeInTheDocument();
  });

  it('logs an error when the server response is not ok', () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderGame();
    fireEvent.click(screen.getByTestId('dice-roll-button'));
    act(() => {
      lastRollAck()({ ok: false, error: 'denied' });
    });
    expect(consoleErr).toHaveBeenCalled();
    consoleErr.mockRestore();
  });

  it('toggles direction to over and uses (100 - t)/100 win prob', () => {
    renderGame();
    fireEvent.click(screen.getByRole('radio', { name: /Roll Over/i }));
    expect(screen.getByTestId('dice-win-chance').textContent).toMatch(/50\.00%/);
  });

  it('plays BIG_WIN when winAmount > bet * 5', () => {
    renderGame();
    fireEvent.click(screen.getByTestId('dice-roll-button'));
    act(() => {
      lastRollAck()({
        ok: true,
        gameId: 'bw1',
        result: 5,
        target: 50,
        direction: 'under',
        win: true,
        multiplier: 9.6,
        winAmount: 96,
        newBalance: 1086,
      });
    });
    const calls = playSpy.mock.calls.map((c) => c[0]);
    expect(calls).toContain('big_win');
    expect(calls).not.toContain('win');
  });
});

describe('previewMultiplier / previewWinProb helpers', () => {
  it('previewMultiplier mirrors under/over symmetry at 50', () => {
    expect(previewMultiplier(50, 'under')).toBeCloseTo(previewMultiplier(50, 'over'), 2);
  });

  it('previewWinProb caps at [0, 1]', () => {
    expect(previewWinProb(99, 'under')).toBeCloseTo(0.99, 2);
    expect(previewWinProb(1, 'under')).toBeCloseTo(0.01, 2);
  });
});
