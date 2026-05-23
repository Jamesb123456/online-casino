import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

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
