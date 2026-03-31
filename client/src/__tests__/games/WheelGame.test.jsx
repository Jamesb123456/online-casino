import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('@/services/socket/wheelSocketService', () => ({
  default: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    setUser: vi.fn(),
    placeBet: vi.fn(),
    onActivePlayers: vi.fn(() => vi.fn()),
    onCurrentBets: vi.fn(() => vi.fn()),
    onPlayerBet: vi.fn(() => vi.fn()),
    onPlayerJoined: vi.fn(() => vi.fn()),
    onPlayerLeft: vi.fn(() => vi.fn()),
    onGameState: vi.fn(() => vi.fn()),
    onResult: vi.fn(() => vi.fn()),
    onError: vi.fn(() => vi.fn()),
    onBetsUpdate: vi.fn(() => vi.fn()),
    onPlayersUpdate: vi.fn(() => vi.fn()),
    onBalanceUpdate: vi.fn(() => vi.fn()),
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

vi.mock('@/games/wheel/WheelBettingPanel', () => ({
  default: (props) => <div data-testid="wheel-betting-panel">Betting Panel</div>,
}));

vi.mock('@/games/wheel/WheelBoard', () => ({
  default: (props) => <div data-testid="wheel-board">Wheel Board</div>,
}));

vi.mock('@/games/wheel/WheelActiveBets', () => ({
  default: (props) => <div data-testid="wheel-active-bets">Active Bets</div>,
}));

vi.mock('@/games/wheel/WheelPlayersList', () => ({
  default: (props) => <div data-testid="wheel-players">Players</div>,
}));

import WheelGame from '@/games/wheel/WheelGame';

describe('WheelGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderGame = () => {
    return render(
      <MemoryRouter>
        <WheelGame />
      </MemoryRouter>
    );
  };

  it('should render without crashing', () => {
    renderGame();
  });

  it('should render betting panel', () => {
    renderGame();
    expect(screen.getByTestId('wheel-betting-panel')).toBeInTheDocument();
  });

  it('should render wheel board', () => {
    renderGame();
    expect(screen.getByTestId('wheel-board')).toBeInTheDocument();
  });

  it('should render active bets', () => {
    renderGame();
    expect(screen.getByTestId('wheel-active-bets')).toBeInTheDocument();
  });
});
