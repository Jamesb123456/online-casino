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

// Replace the Pixi-backed board with a sentinel so this test stays focused on
// the shell + bet panel composition.
vi.mock('@/games/wheel/WheelBoard', () => ({
  default: () => <div data-testid="wheel-board">Wheel Board</div>,
}));

// Bet panel is composed from the shared primitives; we render the real one to
// catch integration issues with `extra`, `bet`, etc.

describe('WheelGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderGame = async () => {
    const { default: WheelGame } = await import('@/games/wheel/WheelGame');
    return render(
      <MemoryRouter>
        <WheelGame />
      </MemoryRouter>,
    );
  };

  it('renders the Wheel title via GameShell', async () => {
    await renderGame();
    expect(
      screen.getByRole('heading', { name: /wheel/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it('renders the wheel board sentinel', async () => {
    await renderGame();
    expect(screen.getByTestId('wheel-board')).toBeInTheDocument();
  });

  it('renders the unified bet panel with risk tier controls', async () => {
    await renderGame();
    // Risk tier buttons present
    expect(screen.getByRole('button', { name: /easy/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /medium/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hard/i })).toBeInTheDocument();
    // Primary CTA
    expect(screen.getByRole('button', { name: /^Spin$/i })).toBeInTheDocument();
  });
});
