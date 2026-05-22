import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

const { mockGetGameDetail } = vi.hoisted(() => ({
  mockGetGameDetail: vi.fn(),
}));

vi.mock('@/services/admin/analyticsService', () => ({
  default: { getGameDetail: mockGetGameDetail },
}));

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

import GameDetail from '@/components/admin/GameDetail';

const sampleDetail = {
  summary: {
    totalSessions: 50,
    totalBetsAmount: 2500,
    totalPayoutsAmount: 2000,
    houseProfit: 500,
    houseEdge: 20,
    winRate: 45,
    lossRate: 50,
    pushRate: 5,
    uniquePlayers: 12,
    averageBet: 50,
    maxBet: 500,
    averageMultiplier: 1.5,
    avgSessionDuration: 120,
  },
  timeSeries: [
    { date: '2025-05-01', betsAmount: 500, payoutsAmount: 400, profit: 100 },
    { date: '2025-05-02', betsAmount: 600, payoutsAmount: 500, profit: 100 },
  ],
  topPlayers: [
    { userId: 1, username: 'alice', sessionsPlayed: 5, totalWagered: 500, totalWon: 400, netProfit: -100 },
  ],
};

function renderGameDetail(gameType = 'crash') {
  return render(
    <MemoryRouter initialEntries={[`/admin/analytics/games/${gameType}`]}>
      <Routes>
        <Route path="/admin/analytics/games/:gameType" element={<GameDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('GameDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading state while fetching', () => {
    mockGetGameDetail.mockReturnValue(new Promise(() => {}));
    renderGameDetail();
    expect(screen.getByText(/Loading Crash analytics/i)).toBeInTheDocument();
  });

  it('renders the empty state when the summary is missing', async () => {
    mockGetGameDetail.mockResolvedValue({ summary: null });
    renderGameDetail();
    await waitFor(() => {
      expect(screen.getByText(/No data available for this game and period/i)).toBeInTheDocument();
    });
  });

  it('renders KPIs and Top Players when data is provided', async () => {
    mockGetGameDetail.mockResolvedValue(sampleDetail);
    renderGameDetail('crash');
    await waitFor(() => {
      expect(screen.getAllByText('Sessions').length).toBeGreaterThan(0);
    });
    expect(screen.getByText('House Profit')).toBeInTheDocument();
    expect(screen.getByText('Unique Players')).toBeInTheDocument();
    expect(screen.getByText('Top Players')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();
  });
});
