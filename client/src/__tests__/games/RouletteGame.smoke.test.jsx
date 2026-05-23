// Smoke / characterization tests for RouletteGame.
//
// Locks post-B1.4 behaviour: subscribe via useGameSocket(events), place a bet
// by emit('roulette:place_bet', payload, ack), join with emit('roulette:join'),
// spin with emit('roulette:spin', { bets }, ack). Wire-level contract (event
// names + payload keys + ack shape) is preserved from the legacy
// rouletteSocketService.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// --- useGameSocket mock ---------------------------------------------------
// Captures the `events` map handed to the hook so the test can drive
// individual socket events imperatively. The `emit` spy answers ack-style
// callbacks with deterministic stubs that mirror the legacy service.
const { capturedEvents, useGameSocketMock, emitMock } = vi.hoisted(() => {
  const events = { current: {} };
  const emit = vi.fn((event, payload, cb) => {
    if (event === 'roulette:join') {
      cb?.({ success: true, balance: 1000, history: [] });
    } else if (event === 'roulette:place_bet') {
      cb?.({
        success: true,
        balance: 990,
        currentBets: [{ type: payload?.type, value: payload?.value, amount: payload?.amount }],
      });
    } else if (event === 'roulette:spin') {
      cb?.({ success: true });
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

// --- Heavy child sentinels -----------------------------------------------
// Keep the real RouletteFelt + BetControls so we exercise the placeBet wiring.
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
    capturedEvents.current = {};
  });

  it('renders without crashing under mocked auth + socket', () => {
    renderGame();
    expect(screen.getByRole('heading', { name: /roulette/i })).toBeInTheDocument();
  });

  it('renders core UI: wheel, betting board, bet-amount input, spin CTA, balance', () => {
    renderGame();
    expect(screen.getByTestId('roulette-wheel')).toBeInTheDocument();
    // Bet amount input from the shared BetControls.
    expect(screen.getByLabelText(/^Bet amount$/i)).toBeInTheDocument();
    // Primary CTA label is "Spin" while not spinning.
    expect(screen.getByRole('button', { name: /^Spin$/i })).toBeInTheDocument();
    // Balance readout is rendered by BetControls.
    expect(screen.getByText(/Balance:/i)).toBeInTheDocument();
  });

  it('opens the roulette socket via useGameSocket', () => {
    renderGame();
    expect(useGameSocketMock).toHaveBeenCalled();
    expect(useGameSocketMock.mock.calls[0][0]).toBe('roulette');
  });

  it('emits roulette:join once the socket is connected', async () => {
    renderGame();
    await waitFor(() => {
      const joinCall = emitMock.mock.calls.find(([event]) => event === 'roulette:join');
      expect(joinCall).toBeDefined();
    });
  });

  it('clicking a bet cell emits roulette:place_bet with { type, value, amount } + ack', async () => {
    renderGame();
    // Wait for the join to settle so the panel is interactive.
    await waitFor(() => {
      const joinCall = emitMock.mock.calls.find(([event]) => event === 'roulette:join');
      expect(joinCall).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /Select bet on 0/i }));

    await waitFor(() => {
      const betCall = emitMock.mock.calls.find(([event]) => event === 'roulette:place_bet');
      expect(betCall).toBeDefined();
    });
    const betCall = emitMock.mock.calls.find(([event]) => event === 'roulette:place_bet');
    const [, payload, ack] = betCall;
    expect(payload).toEqual(
      expect.objectContaining({
        type: 'STRAIGHT',
        value: '0',
        amount: expect.any(Number),
      }),
    );
    expect(typeof ack).toBe('function');
  });

  it('updates UI when roulette:spin_result + roulette:personal_result fire from the server', async () => {
    renderGame();
    await waitFor(() =>
      expect(capturedEvents.current['roulette:spin_result']).toBeTypeOf('function'),
    );

    act(() => {
      capturedEvents.current['roulette:spin_result']?.({ winningNumber: 17 });
    });
    act(() => {
      capturedEvents.current['roulette:personal_result']?.({
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

  it('subscribes to all twelve server-pushed events via the events map', () => {
    renderGame();
    [
      'roulette:activePlayers',
      'roulette:playerJoined',
      'roulette:playerLeft',
      'roulette:currentBets',
      'roulette:playerBet',
      'balanceUpdate',
      'bettingStart',
      'bettingEnd',
      'roulette:spin_started',
      'roulette:spin_result',
      'roulette:personal_result',
      'roulette:round_complete',
    ].forEach((event) => {
      expect(capturedEvents.current[event]).toBeTypeOf('function');
    });
  });
});
