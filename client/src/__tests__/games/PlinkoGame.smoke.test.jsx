// Smoke / characterization tests for PlinkoGame.
//
// Locks post-B1.2 behaviour: Drop Ball -> useGameSocket emit('plinko:drop_ball',
// { betAmount, rows, risk }, cb), the 'plinko:game_result' handler sets the
// animation path, and PlinkoBoard's onAnimationComplete updates the history
// pills. Wire-level contract (event names + payload keys + ack shape) is
// preserved from the legacy plinkoSocketService.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// --- useGameSocket mock ---------------------------------------------------
// Captures the `events` map handed to the hook so the test can drive
// individual socket events (game_result, error, balanceUpdate) imperatively.
const { capturedEvents, useGameSocketMock, emitMock } = vi.hoisted(() => {
  const events = { current: {} };
  const emit = vi.fn((event, _payload, cb) => {
    if (event === 'plinko:drop_ball') {
      // Mimic the server ack: success with a deterministic path.
      cb?.({ success: true, path: [0, 1, 0, 1, 0, 1, 0, 1] });
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

// Stub PlinkoBoard but expose its onAnimationComplete prop so the test can
// drive the "ball landed in bucket N" leg of the flow without pulling in pixi
// or matter-js.
const { plinkoBoardCtx } = vi.hoisted(() => ({ plinkoBoardCtx: { onAnimationComplete: null } }));
vi.mock('@/games/plinko/PlinkoBoard', () => ({
  default: (props) => {
    plinkoBoardCtx.onAnimationComplete = props.onAnimationComplete;
    return (
      <div
        data-testid="plinko-board"
        data-buckets={(props.multipliers || []).length}
      />
    );
  },
}));

import PlinkoGame from '@/games/plinko/PlinkoGame';

const renderGame = () =>
  render(
    <MemoryRouter>
      <PlinkoGame />
    </MemoryRouter>,
  );

describe('PlinkoGame (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedEvents.current = {};
    plinkoBoardCtx.onAnimationComplete = null;
  });

  it('renders without crashing under mocked auth + socket', () => {
    renderGame();
    expect(screen.getByRole('heading', { name: /plinko/i })).toBeInTheDocument();
  });

  it('renders core UI: Plinko board, bet input, Drop Ball CTA, balance label', () => {
    renderGame();
    expect(screen.getByTestId('plinko-board')).toBeInTheDocument();
    expect(screen.getByLabelText(/bet amount/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /drop ball/i })).toBeInTheDocument();
    expect(screen.getByText(/^Balance$/i)).toBeInTheDocument();
  });

  it('exposes risk and rows controls', () => {
    renderGame();
    expect(screen.getByRole('button', { name: /^low$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^medium$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^high$/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/rows/i)).toBeInTheDocument();
  });

  it('opens the plinko socket via useGameSocket', () => {
    renderGame();
    expect(useGameSocketMock).toHaveBeenCalled();
    expect(useGameSocketMock.mock.calls[0][0]).toBe('plinko');
  });

  it('clicking Drop Ball emits plinko:drop_ball with { betAmount, rows, risk } + ack', async () => {
    renderGame();

    fireEvent.click(screen.getByRole('button', { name: /drop ball/i }));

    await waitFor(() => expect(emitMock).toHaveBeenCalled());
    const dropCall = emitMock.mock.calls.find(([event]) => event === 'plinko:drop_ball');
    expect(dropCall).toBeDefined();
    const [, payload, ack] = dropCall;
    expect(payload).toEqual({ betAmount: 10, rows: 16, risk: 'medium' }); // defaults
    expect(typeof ack).toBe('function');
  });

  it('changing risk and rows propagates to the next drop_ball payload', async () => {
    renderGame();

    fireEvent.click(screen.getByRole('button', { name: /^high$/i }));
    fireEvent.change(screen.getByLabelText(/rows/i), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: /drop ball/i }));

    await waitFor(() => {
      const drops = emitMock.mock.calls.filter(([event]) => event === 'plinko:drop_ball');
      expect(drops.length).toBeGreaterThan(0);
    });
    const dropCall = emitMock.mock.calls.find(([event]) => event === 'plinko:drop_ball');
    const [, payload] = dropCall;
    expect(payload.rows).toBe(8);
    expect(payload.risk).toBe('high');
  });

  it('completing the animation pushes a multiplier pill into the history', async () => {
    renderGame();

    fireEvent.click(screen.getByRole('button', { name: /drop ball/i }));
    await waitFor(() => expect(plinkoBoardCtx.onAnimationComplete).toBeTypeOf('function'));

    // Drive the "ball landed in bucket 0" callback.
    await act(async () => {
      plinkoBoardCtx.onAnimationComplete?.(0);
    });

    // History region renders a multiplier pill (e.g. "5.00x" / "1.00x"). We
    // assert any pill containing an "x" suffix appears.
    await waitFor(() => {
      const region = screen.getByLabelText(/Recent multipliers/i);
      expect(region.textContent).toMatch(/\d+(?:\.\d+)?x/);
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

  it('subscribes to plinko:game_result and plinko:error via the events map', () => {
    renderGame();
    expect(capturedEvents.current['plinko:game_result']).toBeTypeOf('function');
    expect(capturedEvents.current['plinko:error']).toBeTypeOf('function');
  });
});
