import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const { mockGet, mockPost, mockUseAuth } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  default: () => mockUseAuth(),
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/services/api', () => ({
  default: { get: mockGet, post: mockPost, put: vi.fn(), delete: vi.fn() },
  api: { get: mockGet, post: mockPost, put: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/layouts/MainLayout', () => ({
  default: ({ children }) => <div data-testid="main-layout">{children}</div>,
}));

vi.mock('@/contexts/ToastContext', () => {
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  return { useToast: () => toast };
});

import TournamentsPage from '@/pages/TournamentsPage';

describe('TournamentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { userId: 100, username: 'player', role: 'user' } });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <TournamentsPage />
      </MemoryRouter>
    );

  it('renders empty state when no active tournaments', async () => {
    mockGet.mockResolvedValue({ tournaments: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/No active tournaments/i)).toBeInTheDocument();
    });
  });

  it('renders tournament cards with leaderboard', async () => {
    mockGet.mockResolvedValue({
      tournaments: [
        {
          id: 5,
          name: 'Friday Crash',
          gameType: 'crash',
          scoring: 'biggest_win',
          startTime: new Date(Date.now() - 60_000).toISOString(),
          endTime: new Date(Date.now() + 3_600_000).toISOString(),
          prizePool: 1000,
          status: 'active',
          leaderboard: [
            { userId: 200, score: 500, totalWagered: 500, totalWon: 0, biggestWin: 0, rank: null },
            { userId: 100, score: 300, totalWagered: 300, totalWon: 0, biggestWin: 0, rank: null },
          ],
          myEntry: { userId: 100, score: 300, totalWagered: 300, totalWon: 0, biggestWin: 0, rank: 2 },
        },
      ],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('tournament-card-5')).toBeInTheDocument();
    });
    expect(screen.getByText('Friday Crash')).toBeInTheDocument();
    expect(screen.getByTestId('my-entry-5')).toBeInTheDocument();
    expect(screen.getByText('#2')).toBeInTheDocument();
  });

  it('highlights the current user in the leaderboard', async () => {
    mockGet.mockResolvedValue({
      tournaments: [
        {
          id: 5,
          name: 'T',
          gameType: 'crash',
          scoring: 'biggest_win',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + 60_000).toISOString(),
          prizePool: 100,
          status: 'active',
          leaderboard: [
            { userId: 100, score: 500, totalWagered: 500, totalWon: 0, biggestWin: 0, rank: null },
          ],
          myEntry: null,
        },
      ],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('leaderboard-row-5-100')).toBeInTheDocument();
    });
    expect(screen.getByText('You')).toBeInTheDocument();
  });

  it('loads active tournaments on mount', async () => {
    mockGet.mockResolvedValue({ tournaments: [] });
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/tournaments/active');
    });
  });
});
