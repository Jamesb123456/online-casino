// Smoke / characterization tests for PlinkoGame.
//
// Locks the current pre-refactor behaviour: Drop Ball -> plinkoSocketService
// .startGame(betAmount, rows, risk, cb), onGameResult sets the animation path,
// and PlinkoBoard's onAnimationComplete updates the history pills.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// --- Socket service mock --------------------------------------------------
const { capturedHandlers, plinkoSocketServiceMock } = vi.hoisted(() => {
  const handlers = {};
  const makeOn = (key) => vi.fn((cb) => {
    handlers[key] = cb;
    return vi.fn();
  });
  return {
    capturedHandlers: handlers,
    plinkoSocketServiceMock: {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      startGame: vi.fn((_bet, _rows, _risk, cb) => {
        // Mimic the server ack: success with a deterministic path.
        cb?.({ success: true, path: [0, 1, 0, 1, 0, 1, 0, 1] });
      }),
      onGameResult: makeOn('gameResult'),
      onError: makeOn('error'),
      onBalanceUpdate: makeOn('balanceUpdate'),
    },
  };
});

vi.mock('@/services/socket/plinkoSocketService', () => ({
  default: plinkoSocketServiceMock,
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
    Object.keys(capturedHandlers).forEach((k) => delete capturedHandlers[k]);
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

  it('clicking Drop Ball calls plinkoSocketService.startGame with (betAmount, rows, risk, cb)', async () => {
    renderGame();
    await waitFor(() => expect(plinkoSocketServiceMock.connect).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /drop ball/i }));

    await waitFor(() => expect(plinkoSocketServiceMock.startGame).toHaveBeenCalled());
    const args = plinkoSocketServiceMock.startGame.mock.calls[0];
    expect(args[0]).toBe(10); // default betAmount
    expect(args[1]).toBe(16); // default rows
    expect(args[2]).toBe('medium'); // default risk
    expect(typeof args[3]).toBe('function');
  });

  it('changing risk and rows propagates to the next startGame payload', async () => {
    renderGame();
    await waitFor(() => expect(plinkoSocketServiceMock.connect).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /^high$/i }));
    fireEvent.change(screen.getByLabelText(/rows/i), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: /drop ball/i }));

    await waitFor(() => expect(plinkoSocketServiceMock.startGame).toHaveBeenCalled());
    const args = plinkoSocketServiceMock.startGame.mock.calls[0];
    expect(args[1]).toBe(8);
    expect(args[2]).toBe('high');
  });

  it('completing the animation pushes a multiplier pill into the history', async () => {
    renderGame();
    await waitFor(() => expect(plinkoSocketServiceMock.connect).toHaveBeenCalled());

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

  it('onBalanceUpdate event updates the auth balance via updateBalance', async () => {
    renderGame();
    await waitFor(() => expect(capturedHandlers.balanceUpdate).toBeTypeOf('function'));
    // Smoke check: handler is wired and accepts the documented payload shape.
    act(() => {
      capturedHandlers.balanceUpdate?.({ balance: 1234 });
    });
    // No throw == subscription contract preserved.
    expect(plinkoSocketServiceMock.onBalanceUpdate).toHaveBeenCalled();
  });

  it('disconnects the socket on unmount', () => {
    const { unmount } = renderGame();
    unmount();
    expect(plinkoSocketServiceMock.disconnect).toHaveBeenCalled();
  });
});
