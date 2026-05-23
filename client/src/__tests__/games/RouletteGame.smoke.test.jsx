// Smoke / characterization tests for RouletteGame.
//
// These lock the current pre-refactor behaviour so a follow-up refactor can't
// silently change the place-bet payload, the result-pill rendering, or the
// disconnect cleanup. They intentionally exercise the *real* betting panel so
// we cover the click -> rouletteSocketService.placeBet wiring end to end.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// --- Socket service mock --------------------------------------------------
// Capture every event handler the component subscribes to so the test can
// fire results back into the component. Use vi.hoisted so the shared refs are
// initialised before vi.mock factories execute.
const { capturedHandlers, rouletteSocketServiceMock } = vi.hoisted(() => {
  const handlers = {};
  const makeOn = (key) => vi.fn((cb) => {
    handlers[key] = cb;
    return vi.fn();
  });
  return {
    capturedHandlers: handlers,
    rouletteSocketServiceMock: {
      setUser: vi.fn(),
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      joinGame: vi.fn().mockResolvedValue({ success: true, balance: 1000, history: [] }),
      placeBet: vi.fn().mockResolvedValue({
        success: true,
        balance: 990,
        currentBets: [{ type: 'STRAIGHT', value: '0', amount: 10 }],
      }),
      spin: vi.fn().mockResolvedValue({ success: true }),
      ensureConnected: vi.fn().mockResolvedValue(undefined),
      onActivePlayers: makeOn('activePlayers'),
      onPlayerJoined: makeOn('playerJoined'),
      onPlayerLeft: makeOn('playerLeft'),
      onCurrentBets: makeOn('currentBets'),
      onPlayerBet: makeOn('playerBet'),
      onBalanceUpdate: makeOn('balanceUpdate'),
      onBettingStart: makeOn('bettingStart'),
      onBettingEnd: makeOn('bettingEnd'),
      onSpinStarted: makeOn('spinStarted'),
      onSpinResult: makeOn('spinResult'),
      onPersonalResult: makeOn('personalResult'),
      onRoundComplete: makeOn('roundComplete'),
    },
  };
});

vi.mock('@/services/socket/rouletteSocketService', () => ({
  default: rouletteSocketServiceMock,
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

// --- Heavy child sentinels -----------------------------------------------
// Keep the real RouletteBettingPanel so we exercise the placeBet click wiring.
vi.mock('@/games/roulette/RouletteWheel', () => ({
  default: () => <div data-testid="roulette-wheel">Wheel</div>,
}));
vi.mock('@/games/roulette/RouletteActiveBets', () => ({
  default: () => <div data-testid="roulette-active-bets">Active Bets</div>,
}));
vi.mock('@/games/roulette/RoulettePlayersList', () => ({
  default: () => <div data-testid="roulette-players">Players</div>,
}));

import RouletteGame from '@/games/roulette/RouletteGame';

const renderGame = () =>
  render(
    <MemoryRouter>
      <RouletteGame />
    </MemoryRouter>,
  );

describe('RouletteGame (smoke)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(capturedHandlers).forEach((k) => delete capturedHandlers[k]);
  });

  it('renders without crashing under mocked auth + socket', () => {
    renderGame();
    expect(screen.getByRole('heading', { name: /roulette/i })).toBeInTheDocument();
  });

  it('renders core UI: wheel, betting board, bet-amount input, spin CTA, balance', () => {
    renderGame();
    expect(screen.getByTestId('roulette-wheel')).toBeInTheDocument();
    // Bet amount input from the unified BetPanel.
    expect(document.getElementById('roulette-stake-amount')).not.toBeNull();
    // Primary CTA label is "Spin" while not spinning.
    expect(screen.getByRole('button', { name: /^Spin$/i })).toBeInTheDocument();
    // Balance label is shown in the BetPanel.
    expect(screen.getByText(/^Balance$/i)).toBeInTheDocument();
  });

  it('clicking a bet cell calls rouletteSocketService.placeBet with { type, value, amount }', async () => {
    renderGame();
    // Wait for the connect/joinGame chain to settle so the panel is interactive.
    await waitFor(() => expect(rouletteSocketServiceMock.connect).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /Select bet on 0/i }));

    await waitFor(() =>
      expect(rouletteSocketServiceMock.placeBet).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STRAIGHT',
          value: '0',
          amount: expect.any(Number),
        }),
      ),
    );
  });

  it('updates UI when onSpinResult + onPersonalResult fire from the server', async () => {
    renderGame();
    await waitFor(() => expect(capturedHandlers.spinResult).toBeTypeOf('function'));

    act(() => {
      capturedHandlers.spinResult?.({ winningNumber: 17 });
    });
    act(() => {
      capturedHandlers.personalResult?.({
        winningNumber: 17,
        winningColor: 'black',
        bets: [{ type: 'STRAIGHT', value: '17', amount: 10, isWinner: true, profit: 350 }],
        totalWinnings: 360,
        totalProfit: 350,
      });
    });

    // The latest pill should reflect the winning number 17 in the recent results.
    await waitFor(() => {
      const pills = screen.getAllByText('17');
      expect(pills.length).toBeGreaterThan(0);
    });
  });

  it('disconnects the socket on unmount', () => {
    const { unmount } = renderGame();
    unmount();
    expect(rouletteSocketServiceMock.disconnect).toHaveBeenCalled();
  });
});
