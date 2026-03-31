import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('@/services/socket/landminesSocketService', () => ({
  default: {
    connect: vi.fn(() => Promise.resolve()),
    disconnect: vi.fn(),
    joinLandminesGame: vi.fn((cb) => cb && cb({ success: true, balance: 1000, history: [] })),
    leaveLandminesGame: vi.fn(),
    startGame: vi.fn(),
    pickCell: vi.fn(),
    cashOut: vi.fn(),
    onGameState: vi.fn(() => vi.fn()),
    onResult: vi.fn(() => vi.fn()),
    onError: vi.fn(() => vi.fn()),
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

vi.mock('@/games/landmines/LandminesBettingPanel', () => ({
  default: (props) => <div data-testid="landmines-betting-panel">Betting Panel</div>,
}));

vi.mock('@/games/landmines/LandminesBoard', () => ({
  default: (props) => <div data-testid="landmines-board">Board</div>,
}));

import LandminesGame from '@/games/landmines/LandminesGame';

describe('LandminesGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderGame = () => {
    return render(
      <MemoryRouter>
        <LandminesGame />
      </MemoryRouter>
    );
  };

  it('should render without crashing', () => {
    renderGame();
  });

  it('should render betting panel', () => {
    renderGame();
    expect(screen.getByTestId('landmines-betting-panel')).toBeInTheDocument();
  });

  it('should render game board', () => {
    renderGame();
    expect(screen.getByTestId('landmines-board')).toBeInTheDocument();
  });
});
