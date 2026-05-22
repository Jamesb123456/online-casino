import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const { mockGetDashboardStats, mockGetGameStats } = vi.hoisted(() => ({
  mockGetDashboardStats: vi.fn(),
  mockGetGameStats: vi.fn(),
}));

vi.mock('@/services/admin/adminService', () => ({
  default: {
    getDashboardStats: mockGetDashboardStats,
    getGameStats: mockGetGameStats,
  },
}));

import Dashboard from '@/components/admin/Dashboard';

describe('Admin Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard headings and KPI tiles with fetched stats', async () => {
    mockGetDashboardStats.mockResolvedValue({
      totalPlayers: 42,
      activePlayers: 7,
      totalBalance: 1234,
      totalGames: 9,
      recentTransactions: [],
      alerts: [],
    });
    mockGetGameStats.mockResolvedValue({ games: [] });

    render(<Dashboard />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('42')).toBeInTheDocument(); // totalPlayers
      expect(screen.getByText('9')).toBeInTheDocument(); // totalGames
    });
    expect(screen.getByText('Total Players')).toBeInTheDocument();
    expect(screen.getByText('Total Balance')).toBeInTheDocument();
    expect(screen.getByText('Total Games')).toBeInTheDocument();
    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('renders game-stats rows when provided', async () => {
    mockGetDashboardStats.mockResolvedValue({
      totalPlayers: 0,
      activePlayers: 0,
      totalBalance: 0,
      totalGames: 0,
      recentTransactions: [],
      alerts: [],
    });
    mockGetGameStats.mockResolvedValue({
      games: [
        { name: 'Crash', played: 100, profit: 500 },
        { name: 'Roulette', played: 50, profit: 300 },
      ],
    });

    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText('Crash')).toBeInTheDocument();
      expect(screen.getByText('Roulette')).toBeInTheDocument();
    });
  });

  it('shows an error alert when stats fetch fails', async () => {
    mockGetDashboardStats.mockRejectedValue(new Error('nope'));
    mockGetGameStats.mockRejectedValue(new Error('nope'));

    render(<Dashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load dashboard data/i)).toBeInTheDocument();
    });
  });
});
