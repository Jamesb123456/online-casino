import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('@/services/socket/rouletteSocketService', () => ({
  default: {
    setUser: vi.fn(),
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn(),
    joinGame: vi.fn().mockResolvedValue({ success: true, balance: 1000, history: [] }),
    placeBet: vi.fn(),
    spin: vi.fn(),
    ensureConnected: vi.fn().mockResolvedValue(undefined),
    onActivePlayers: vi.fn(() => vi.fn()),
    onPlayerJoined: vi.fn(() => vi.fn()),
    onPlayerLeft: vi.fn(() => vi.fn()),
    onCurrentBets: vi.fn(() => vi.fn()),
    onPlayerBet: vi.fn(() => vi.fn()),
    onBalanceUpdate: vi.fn(() => vi.fn()),
    onBettingStart: vi.fn(() => vi.fn()),
    onBettingEnd: vi.fn(() => vi.fn()),
    onSpinStarted: vi.fn(() => vi.fn()),
    onSpinResult: vi.fn(() => vi.fn()),
    onPersonalResult: vi.fn(() => vi.fn()),
    onRoundComplete: vi.fn(() => vi.fn()),
  },
}));

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: React.createContext({
    user: { id: 1, username: 'testuser', balance: 1000 },
    updateBalance: vi.fn(),
  }),
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

vi.mock('@/games/roulette/RouletteBettingPanel', () => ({
  default: (_props) => <div data-testid="roulette-betting-panel">Betting Panel</div>,
}));

vi.mock('@/games/roulette/RouletteWheel', () => ({
  default: (_props) => <div data-testid="roulette-wheel">Wheel</div>,
}));

vi.mock('@/games/roulette/RouletteActiveBets', () => ({
  default: (_props) => <div data-testid="roulette-active-bets">Active Bets</div>,
}));

vi.mock('@/games/roulette/RoulettePlayersList', () => ({
  default: (_props) => <div data-testid="roulette-players">Players</div>,
}));

import RouletteGame from '@/games/roulette/RouletteGame';

describe('RouletteGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderGame = () => {
    return render(
      <MemoryRouter>
        <RouletteGame />
      </MemoryRouter>
    );
  };

  it('should render without crashing', () => {
    renderGame();
  });

  it('should render betting panel', () => {
    renderGame();
    expect(screen.getByTestId('roulette-betting-panel')).toBeInTheDocument();
  });

  it('should render roulette wheel', () => {
    renderGame();
    expect(screen.getByTestId('roulette-wheel')).toBeInTheDocument();
  });

  it('should render active bets', () => {
    renderGame();
    expect(screen.getByTestId('roulette-active-bets')).toBeInTheDocument();
  });
});
