import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';

const { mockGetRevenue } = vi.hoisted(() => ({
  mockGetRevenue: vi.fn(),
}));

vi.mock('@/services/admin/analyticsService', () => ({
  default: { getRevenue: mockGetRevenue },
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

import RevenueDashboard from '@/components/admin/RevenueDashboard';

const sampleData = {
  summary: {
    totalRevenue: 5000,
    totalDeposits: 8000,
    totalWithdrawals: 3000,
    netCashflow: 5000,
    arpu: 250,
    activePlayerCount: 20,
    grossGamingRevenue: 5500,
    totalBonusesPaid: 500,
  },
  timeSeries: [
    { date: '2025-05-01', revenue: 100, deposits: 200, withdrawals: 100, activePlayers: 10, newPlayers: 2, gamesPlayed: 50 },
    { date: '2025-05-02', revenue: 200, deposits: 300, withdrawals: 150, activePlayers: 12, newPlayers: 3, gamesPlayed: 75 },
  ],
  revenueByGame: [
    { gameType: 'crash', revenue: 3000, percentOfTotal: 60 },
    { gameType: 'roulette', revenue: 2000, percentOfTotal: 40 },
  ],
};

describe('RevenueDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows a loading state initially', () => {
    mockGetRevenue.mockReturnValue(new Promise(() => {}));
    render(<RevenueDashboard />);
    expect(screen.getByText(/Loading revenue data/i)).toBeInTheDocument();
  });

  it('shows an error state with retry when fetch fails', async () => {
    mockGetRevenue.mockRejectedValue(new Error('boom'));
    render(<RevenueDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/Failed to load revenue data/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('shows an empty state when there is no time-series data', async () => {
    mockGetRevenue.mockResolvedValue({ summary: {}, timeSeries: [], revenueByGame: [] });
    render(<RevenueDashboard />);
    await waitFor(() => {
      expect(screen.getByText(/No revenue data available/i)).toBeInTheDocument();
    });
  });

  it('renders KPIs and section headings with valid data', async () => {
    mockGetRevenue.mockResolvedValue(sampleData);
    render(<RevenueDashboard />);
    await waitFor(() => {
      expect(screen.getByText('Revenue Dashboard')).toBeInTheDocument();
    });
    expect(screen.getByText('Total Revenue')).toBeInTheDocument();
    expect(screen.getByText('Total Deposits')).toBeInTheDocument();
    expect(screen.getByText('Net Cashflow')).toBeInTheDocument();
    expect(screen.getByText('ARPU')).toBeInTheDocument();
    expect(screen.getByText('Revenue Trend')).toBeInTheDocument();
    expect(screen.getByText('Period Summary')).toBeInTheDocument();
  });
});
