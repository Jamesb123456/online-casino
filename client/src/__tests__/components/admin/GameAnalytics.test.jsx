import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const { mockGetAllGamesOverview } = vi.hoisted(() => ({
  mockGetAllGamesOverview: vi.fn(),
}));

vi.mock('@/services/admin/analyticsService', () => ({
  default: { getAllGamesOverview: mockGetAllGamesOverview },
}));

// Recharts has known issues in jsdom; mock it out with explicit exports.
vi.mock('recharts', async () => {
  const React = await import('react');
  const Stub = ({ children }) =>
    React.createElement('div', { 'data-testid': 'recharts-stub' }, children);
  return {
    ResponsiveContainer: Stub,
    LineChart: Stub, Line: Stub,
    BarChart: Stub, Bar: Stub,
    PieChart: Stub, Pie: Stub, Cell: Stub,
    AreaChart: Stub, Area: Stub,
    XAxis: Stub, YAxis: Stub,
    CartesianGrid: Stub, Tooltip: Stub, Legend: Stub,
  };
});

import GameAnalytics from '@/components/admin/GameAnalytics';

const sampleData = {
  totals: {
    totalSessions: 100,
    totalBetsAmount: 5000,
    houseProfit: 750,
    overallHouseEdge: 15,
  },
  games: [
    {
      gameType: 'crash',
      totalSessions: 60,
      totalBetsAmount: 3000,
      houseProfit: 500,
      houseEdge: 16.6,
      winRate: 45,
    },
    {
      gameType: 'roulette',
      totalSessions: 40,
      totalBetsAmount: 2000,
      houseProfit: 250,
      houseEdge: 12.5,
      winRate: 47,
    },
  ],
};

function renderGameAnalytics() {
  return render(
    <MemoryRouter>
      <GameAnalytics />
    </MemoryRouter>
  );
}

describe('GameAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading state while fetching', () => {
    mockGetAllGamesOverview.mockReturnValue(new Promise(() => {}));
    renderGameAnalytics();
    expect(screen.getByText(/Loading game analytics/i)).toBeInTheDocument();
  });

  it('renders an empty state when no games are returned', async () => {
    mockGetAllGamesOverview.mockResolvedValue({ games: [], totals: {} });
    renderGameAnalytics();
    await waitFor(() => {
      expect(screen.getByText(/No game data available for this period/i)).toBeInTheDocument();
    });
  });

  it('renders KPIs and per-game cards with fetched data', async () => {
    mockGetAllGamesOverview.mockResolvedValue(sampleData);
    renderGameAnalytics();
    await waitFor(() => {
      expect(screen.getByText('Total Sessions')).toBeInTheDocument();
    });
    expect(screen.getByText('Total Wagered')).toBeInTheDocument();
    // "House Profit" and "House Edge" appear both as KPI labels and per-game
    // card stats, so we use getAllByText to assert they appear at least once.
    expect(screen.getAllByText('House Profit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('House Edge').length).toBeGreaterThan(0);
    expect(screen.getByText('Crash')).toBeInTheDocument();
    expect(screen.getByText('Roulette')).toBeInTheDocument();
  });
});
