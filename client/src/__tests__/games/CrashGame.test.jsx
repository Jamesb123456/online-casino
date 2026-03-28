import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Mock all crash-related dependencies
vi.mock('@/services/socket/crashSocketService', () => ({
  default: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    setUser: vi.fn(),
    joinCrashGame: vi.fn(),
    leaveCrashGame: vi.fn(),
    onGameStateChange: vi.fn(() => vi.fn()),
    onMultiplierUpdate: vi.fn(() => vi.fn()),
    onGameStarting: vi.fn(() => vi.fn()),
    onGameStarted: vi.fn(() => vi.fn()),
    onGameCrashed: vi.fn(() => vi.fn()),
    onPlayerBet: vi.fn(() => vi.fn()),
    onPlayerCashout: vi.fn(() => vi.fn()),
    onCurrentBets: vi.fn(() => vi.fn()),
    onActivePlayers: vi.fn(() => vi.fn()),
    onPlayerJoined: vi.fn(() => vi.fn()),
    onPlayerLeft: vi.fn(() => vi.fn()),
    onConnectError: vi.fn(() => vi.fn()),
    offConnectError: vi.fn(),
    onGameHistory: vi.fn(() => vi.fn()),
    onActiveBets: vi.fn(() => vi.fn()),
    onBetPlaced: vi.fn(() => vi.fn()),
    onBetCashout: vi.fn(() => vi.fn()),
    onError: vi.fn(() => vi.fn()),
    placeBet: vi.fn(),
    cashOut: vi.fn(),
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

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

// Mock child components
vi.mock('@/games/crash/CrashBettingPanel', () => ({
  default: () => <div data-testid="crash-betting-panel">Betting Panel</div>,
}));

vi.mock('@/games/crash/CrashHistory', () => ({
  default: () => <div data-testid="crash-history">History</div>,
}));

vi.mock('@/games/crash/CrashPlayersList', () => ({
  default: () => <div data-testid="crash-players">Players</div>,
}));

vi.mock('@/games/crash/CrashActiveBets', () => ({
  default: () => <div data-testid="crash-active-bets">Active Bets</div>,
}));

vi.mock('@/games/crash/crashUtils', () => ({
  formatMultiplier: vi.fn((m) => `${m}x`),
  getMultiplierColor: vi.fn(() => 'text-white'),
}));

// Mock canvas API for jsdom
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  arc: vi.fn(),
  closePath: vi.fn(),
  setLineDash: vi.fn(),
  measureText: vi.fn(() => ({ width: 0 })),
  createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  canvas: { width: 800, height: 400 },
}));

import CrashGame from '@/games/crash/CrashGame';

describe('CrashGame', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderGame = () => {
    return render(
      <MemoryRouter>
        <CrashGame />
      </MemoryRouter>
    );
  };

  it('should render without crashing', () => {
    renderGame();
    // The component should mount without errors
  });

  it('should render betting panel', () => {
    renderGame();
    expect(screen.getByTestId('crash-betting-panel')).toBeInTheDocument();
  });

  it('should render game history', () => {
    renderGame();
    expect(screen.getByTestId('crash-history')).toBeInTheDocument();
  });

  it('should render active bets', () => {
    renderGame();
    expect(screen.getByTestId('crash-active-bets')).toBeInTheDocument();
  });
});
