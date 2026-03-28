import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));
vi.mock('@/services/api', () => ({
  api: { get: mockGet },
}));

vi.mock('@/layouts/MainLayout', () => ({
  default: ({ children }) => <div data-testid="main-layout">{children}</div>,
}));

import LeaderboardPage from '@/pages/LeaderboardPage';

describe('LeaderboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      leaderboard: [
        { id: 1, username: 'player1', totalWinnings: '5000.00', totalGames: 100 },
        { id: 2, username: 'player2', totalWinnings: '3000.00', totalGames: 75 },
        { id: 3, username: 'player3', totalWinnings: '1000.00', totalGames: 50 },
      ],
    });
  });

  const renderPage = () => {
    return render(
      <MemoryRouter>
        <LeaderboardPage />
      </MemoryRouter>
    );
  };

  it('should render leaderboard heading', () => {
    renderPage();
    expect(screen.getByText('Leaderboard')).toBeInTheDocument();
  });

  it('should render period tabs', () => {
    renderPage();
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(screen.getByText('Weekly')).toBeInTheDocument();
    expect(screen.getByText('All Time')).toBeInTheDocument();
  });

  it('should show loading state initially', () => {
    mockGet.mockImplementation(() => new Promise(() => {}));
    renderPage();
    // Loading spinner should be present
    expect(screen.queryByText('Rank')).not.toBeInTheDocument();
  });

  it('should display leaderboard data after loading', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('player1')).toBeInTheDocument();
      expect(screen.getByText('player2')).toBeInTheDocument();
      expect(screen.getByText('player3')).toBeInTheDocument();
    });
  });

  it('should fetch with allTime period by default', () => {
    renderPage();
    expect(mockGet).toHaveBeenCalledWith('/leaderboard', {
      params: { period: 'allTime', limit: 20 },
    });
  });

  it('should switch periods on tab click', async () => {
    renderPage();
    const user = userEvent.setup();
    await user.click(screen.getByText('Daily'));
    expect(mockGet).toHaveBeenCalledWith('/leaderboard', {
      params: { period: 'daily', limit: 20 },
    });
  });

  it('should display error state', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/failed to load leaderboard/i)).toBeInTheDocument();
    });
  });

  it('should have retry button on error', async () => {
    mockGet.mockRejectedValue(new Error('Network error'));
    renderPage();
    // Wait for the error message first (which confirms the error state rendered)
    await waitFor(() => {
      expect(screen.getByText(/failed to load leaderboard/i)).toBeInTheDocument();
    }, { timeout: 5000 });
    // Then check for retry button — use getByRole to avoid matching "try again" in error message text
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('should show empty state when no data', async () => {
    mockGet.mockResolvedValue({ leaderboard: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no data yet/i)).toBeInTheDocument();
    });
  });

  it('should display table headers', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Rank')).toBeInTheDocument();
      expect(screen.getByText('Player')).toBeInTheDocument();
      expect(screen.getByText('Winnings')).toBeInTheDocument();
      expect(screen.getByText('Games')).toBeInTheDocument();
    });
  });
});
