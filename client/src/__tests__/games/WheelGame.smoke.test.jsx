// Smoke / characterization tests for WheelGame.
//
// Locks the current pre-refactor behaviour: Spin button -> wheelSocketService
// .placeBet({ betAmount, difficulty }) -> WheelBoard onSpinComplete -> history
// pill renders.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// --- Socket service mock --------------------------------------------------
const { capturedHandlers, wheelSocketServiceMock } = vi.hoisted(() => {
  const handlers = {};
  const makeOn = (key) => vi.fn((cb) => {
    handlers[key] = cb;
    return vi.fn();
  });
  return {
    capturedHandlers: handlers,
    wheelSocketServiceMock: {
      setUser: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      placeBet: vi.fn().mockResolvedValue({
        segmentIndex: 2,
        multiplier: 2,
        winAmount: 20,
        profit: 10,
        targetAngle: 120,
      }),
      onActivePlayers: makeOn('activePlayers'),
      onCurrentBets: makeOn('currentBets'),
      onPlayerBet: makeOn('playerBet'),
      onPlayerJoined: makeOn('playerJoined'),
      onPlayerLeft: makeOn('playerLeft'),
      onGameState: makeOn('gameState'),
      onResult: makeOn('result'),
      onError: makeOn('error'),
      onBetsUpdate: makeOn('betsUpdate'),
      onPlayersUpdate: makeOn('playersUpdate'),
      onBalanceUpdate: makeOn('balanceUpdate'),
    },
  };
});

vi.mock('@/services/socket/wheelSocketService', () => ({
  default: wheelSocketServiceMock,
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
    Object.keys(capturedHandlers).forEach((k) => delete capturedHandlers[k]);
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

  it('clicking Spin invokes wheelSocketService.placeBet with { betAmount, difficulty }', async () => {
    renderGame();
    await waitFor(() => expect(wheelSocketServiceMock.connect).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /^Spin$/i }));

    await waitFor(() =>
      expect(wheelSocketServiceMock.placeBet).toHaveBeenCalledWith(
        expect.objectContaining({
          betAmount: expect.any(Number),
          difficulty: 'medium',
        }),
      ),
    );
  });

  it('difficulty buttons change the difficulty payload sent on next Spin', async () => {
    renderGame();
    await waitFor(() => expect(wheelSocketServiceMock.connect).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /^hard$/i }));
    fireEvent.click(screen.getByRole('button', { name: /^Spin$/i }));

    await waitFor(() =>
      expect(wheelSocketServiceMock.placeBet).toHaveBeenCalledWith(
        expect.objectContaining({ difficulty: 'hard' }),
      ),
    );
  });

  it('completes the spin: WheelBoard.onSpinComplete triggers a history pill', async () => {
    renderGame();
    await waitFor(() => expect(wheelSocketServiceMock.connect).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /^Spin$/i }));
    await waitFor(() => expect(wheelSocketServiceMock.placeBet).toHaveBeenCalled());

    // Simulate the GSAP-driven spin completing.
    await act(async () => {
      wheelBoardCtx.onSpinComplete?.();
    });

    // A 2x multiplier should appear in the Recent results region.
    await waitFor(() => {
      expect(screen.getByLabelText(/Recent results/i)).toHaveTextContent(/2/);
    });
  });

  it('disconnects the socket on unmount', () => {
    const { unmount } = renderGame();
    unmount();
    expect(wheelSocketServiceMock.disconnect).toHaveBeenCalled();
  });
});
