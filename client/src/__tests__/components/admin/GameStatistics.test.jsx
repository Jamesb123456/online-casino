import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const { mockGetGameStats } = vi.hoisted(() => ({
  mockGetGameStats: vi.fn(),
}));

vi.mock('@/services/admin/adminService', () => ({
  default: { getGameStats: mockGetGameStats },
}));

import GameStatistics from '@/components/admin/GameStatistics';

describe('GameStatistics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGameStats.mockResolvedValue({
      games: [
        { name: 'Crash', played: 100, profit: 500 },
        { name: 'Roulette', played: 50, profit: 300 },
      ],
    });
  });

  it('renders the page heading and filter selectors', async () => {
    render(<GameStatistics />);
    expect(screen.getByText('Game Statistics')).toBeInTheDocument();
    expect(screen.getByLabelText(/admin-time-range|.*/, { selector: '#admin-time-range' })).toBeInTheDocument();
    expect(screen.getByLabelText(/admin-game-filter|.*/, { selector: '#admin-game-filter' })).toBeInTheDocument();
    await waitFor(() => expect(mockGetGameStats).toHaveBeenCalled());
  });

  it('renders the game breakdown table rows once data loads', async () => {
    render(<GameStatistics />);
    await waitFor(() => {
      expect(screen.getByText('Crash')).toBeInTheDocument();
      expect(screen.getByText('Roulette')).toBeInTheDocument();
    });
    expect(screen.getByText('Game Performance')).toBeInTheDocument();
  });

  it('refetches stats when the time range filter changes', async () => {
    render(<GameStatistics />);
    await waitFor(() => expect(mockGetGameStats).toHaveBeenCalledTimes(1));

    fireEvent.change(document.getElementById('admin-time-range'), {
      target: { value: 'month' },
    });

    await waitFor(() => {
      expect(mockGetGameStats).toHaveBeenCalledWith(
        expect.objectContaining({ timeRange: 'month' })
      );
    });
  });
});
