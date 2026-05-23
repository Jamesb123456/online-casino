// Smoke / characterization tests for WheelGame.
//
// Locks post-B1.3 behaviour: Spin -> useGameSocket emit('wheel:place_bet',
// { betAmount, difficulty }, cb) -> WheelBoard onSpinComplete -> history pill
// renders. Wire-level contract (event name + payload keys + ack shape) is
// preserved from the legacy wheelSocketService.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// --- useGameSocket mock ---------------------------------------------------
// Captures the `events` map handed to the hook so the test can drive
// individual socket events (balanceUpdate, etc.) imperatively. The `emit`
// spy resolves the place_bet ack with a deterministic success payload.
const { capturedEvents, useGameSocketMock, emitMock } = vi.hoisted(() => {
  const events = { current: {} };
  const emit = vi.fn((event, _payload, cb) => {
    if (event === 'wheel:place_bet') {
      cb?.({
        success: true,
        segmentIndex: 2,
        multiplier: 2,
        winAmount: 20,
        profit: 10,
        targetAngle: 120,
      });
    }
  });
  const hook = vi.fn((_gameType, opts) => {
    events.current = (opts && opts.events) || {};
    return {
      socket: null,
      status: 'connected',
      lastError: null,
      serverSeedHash: null,
      emit,
    };
  });
  return { capturedEvents: events, useGameSocketMock: hook, emitMock: emit };
});

vi.mock('@/games/_shared/useGameSocket', () => ({
  __esModule: true,
  default: useGameSocketMock,
  useGameSocket: useGameSocketMock,
}));

// canvas-confetti has no real backend under jsdom — neuter it so WinBurst
// renders don't try to allocate a particle canvas.
vi.mock('canvas-confetti', () => {
  const fn = vi.fn();
  fn.reset = vi.fn();
  return { __esModule: true, default: fn };
});

// --- Context mocks --------------------------------------------------------
vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: React.createContext({
    user: { id: 1, username: 'testuser', balance: 1000 },
    updateBalance: vi.fn(),
  }),
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

// Stub WheelBoard but expose its onSpinComplete prop so the test can drive the
// "animation finished" leg of the flow without pulling in the Pixi renderer.
const { wheelBoardCtx } = vi.hoisted(() => ({ wheelBoardCtx: { onSpinComplete: null } }));
vi.mock('@/games/wheel/WheelBoard', () => ({
  default: (props) => {
    wheelBoardCtx.onSpinComplete = props.onSpinComplete;
    return <div data-testid="wheel-board" data-spinning={String(!!props.spinning)} />;
  },
}));

import WheelGame from '@/games/wheel/WheelGame';

const renderGame = () =>
  render(
    <MemoryRouter>
      <WheelGame />
    </MemoryRouter>,
  );

describe('WheelGame (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedEvents.current = {};
    wheelBoardCtx.onSpinComplete = null;
  });

  it('renders without crashing under mocked auth + socket', () => {
    renderGame();
    expect(screen.getByRole('heading', { name: /wheel/i, level: 1 })).toBeInTheDocument();
  });

  it('renders core UI: wheel board, bet input, Spin CTA, balance label', () => {
    renderGame();
    expect(screen.getByTestId('wheel-board')).toBeInTheDocument();
    expect(document.getElementById('wheel-bet-amount')).not.toBeNull();
    expect(screen.getByRole('button', { name: /^Spin$/i })).toBeInTheDocument();
    expect(screen.getByText(/^Balance$/i)).toBeInTheDocument();
  });

  it('opens the wheel socket via useGameSocket', () => {
    renderGame();
    expect(useGameSocketMock).toHaveBeenCalled();
    expect(useGameSocketMock.mock.calls[0][0]).toBe('wheel');
  });

  it('clicking Spin emits wheel:place_bet with { betAmount, difficulty } + ack', async () => {
    renderGame();

    fireEvent.click(screen.getByRole('button', { name: /^Spin$/i }));

    await waitFor(() => expect(emitMock).toHaveBeenCalled());
    const betCall = emitMock.mock.calls.find(([event]) => event === 'wheel:place_bet');
    expect(betCall).toBeDefined();
    const [, payload, ack] = betCall;
    expect(payload).toEqual(
      expect.objectContaining({
        betAmount: expect.any(Number),
        difficulty: 'medium',
      }),
    );
    expect(typeof ack).toBe('function');
  });

  it('difficulty buttons change the difficulty payload sent on next Spin', async () => {
    renderGame();

    fireEvent.click(screen.getByRole('button', { name: /^hard$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Spin$/i }));

    await waitFor(() => {
      const bets = emitMock.mock.calls.filter(([event]) => event === 'wheel:place_bet');
      expect(bets.length).toBeGreaterThan(0);
    });
    const betCall = emitMock.mock.calls.find(([event]) => event === 'wheel:place_bet');
    const [, payload] = betCall;
    expect(payload.difficulty).toBe('hard');
  });

  it('completes the spin: WheelBoard.onSpinComplete triggers a history pill', async () => {
    renderGame();

    fireEvent.click(screen.getByRole('button', { name: /^Spin$/i }));
    await waitFor(() => expect(emitMock).toHaveBeenCalled());

    // Simulate the GSAP-driven spin completing.
    await act(async () => {
      wheelBoardCtx.onSpinComplete?.();
    });

    // A 2x multiplier should appear in the Recent results region.
    await waitFor(() => {
      expect(screen.getByLabelText(/Recent results/i)).toHaveTextContent(/2/);
    });
  });

  it('balanceUpdate event invokes the handler wired through useGameSocket', () => {
    renderGame();
    expect(capturedEvents.current.balanceUpdate).toBeTypeOf('function');
    // Smoke check: handler is wired and accepts the documented payload shape.
    act(() => {
      capturedEvents.current.balanceUpdate?.({ balance: 1234 });
    });
    // No throw == subscription contract preserved.
  });
});
