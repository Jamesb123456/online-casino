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

// Stub PlinkoBoard so we don't need pixi/matter in this test.
vi.mock('@/games/plinko/PlinkoBoard', () => ({
  default: () => <div data-testid="plinko-board" />,
}));

import PlinkoGame from '@/games/plinko/PlinkoGame';

describe('PlinkoGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderGame = () =>
    render(
      <MemoryRouter>
        <PlinkoGame />
      </MemoryRouter>,
    );

  it('renders without crashing', () => {
    renderGame();
  });

  it('renders the Plinko board', () => {
    renderGame();
    expect(screen.getByTestId('plinko-board')).toBeInTheDocument();
  });

  it('renders the bet panel with the Drop ball CTA', () => {
    renderGame();
    expect(screen.getByRole('button', { name: /drop ball/i })).toBeInTheDocument();
  });

  it('exposes a bet amount input', () => {
    renderGame();
    expect(screen.getByLabelText(/bet amount/i)).toBeInTheDocument();
  });

  it('exposes risk-level controls', () => {
    renderGame();
    expect(screen.getByRole('button', { name: /^low$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^medium$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^high$/i })).toBeInTheDocument();
  });

  it('exposes a rows selector', () => {
    renderGame();
    expect(screen.getByLabelText(/rows/i)).toBeInTheDocument();
  });
});
