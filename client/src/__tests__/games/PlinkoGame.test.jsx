import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

vi.mock('@/services/socket/plinkoSocketService', () => ({
  default: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    startGame: vi.fn(),
    onGameResult: vi.fn(() => vi.fn()),
    onError: vi.fn(() => vi.fn()),
    onResult: vi.fn(() => vi.fn()),
    onBalanceUpdate: vi.fn(() => vi.fn()),
    dropBall: vi.fn(),
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

vi.mock('@/games/plinko/PlinkoBettingPanel', () => ({
  default: (props) => <div data-testid="plinko-betting-panel">Betting Panel</div>,
}));

vi.mock('@/games/plinko/PlinkoBoard', () => ({
  default: (props) => <div data-testid="plinko-board">Board</div>,
}));

import PlinkoGame from '@/games/plinko/PlinkoGame';

describe('PlinkoGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderGame = () => {
    return render(
      <MemoryRouter>
        <PlinkoGame />
      </MemoryRouter>
    );
  };

  it('should render without crashing', () => {
    renderGame();
  });

  it('should render betting panel', () => {
    renderGame();
    expect(screen.getByTestId('plinko-betting-panel')).toBeInTheDocument();
  });

  it('should render game board', () => {
    renderGame();
    expect(screen.getByTestId('plinko-board')).toBeInTheDocument();
  });
});
