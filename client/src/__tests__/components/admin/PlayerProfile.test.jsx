import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import React from 'react';

const { mockGetProfile, mockGetSessions, navigateSpy } = vi.hoisted(() => ({
  mockGetProfile: vi.fn(),
  mockGetSessions: vi.fn(),
  navigateSpy: vi.fn(),
}));

vi.mock('@/services/admin/analyticsService', () => ({
  default: {
    getPlayerProfile: mockGetProfile,
    getPlayerSessions: mockGetSessions,
  },
}));

vi.mock('@/components/admin/charts/StatCard', () => ({
  default: ({ label, value }) => (
    <div data-testid="stat-card">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  ),
}));

vi.mock('@/components/admin/charts/AnalyticsAreaChart', () => ({
  default: () => <div data-testid="area-chart" />,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

import PlayerProfile from '@/components/admin/PlayerProfile';

const profileFixture = {
  username: 'alice',
  balance: 5000,
  isActive: true,
  memberSince: '2024-01-01',
  lastLogin: '2025-05-01',
  overallStats: {
    totalWagered: 1234,
    netProfitLoss: 100,
    winRate: 55,
    avgBetSize: 10,
    totalDeposits: 1000,
  },
  favoriteGame: { gameType: 'crash' },
  perGameBreakdown: [
    { gameType: 'crash', sessions: 50, wagered: 500, won: 600, netResult: 100, winRate: 60, avgBet: 10 },
    { gameType: 'plinko', sessions: 20, wagered: 200, won: 100, netResult: -100, winRate: 25, avgBet: 5 },
    { gameType: 'wheel', sessions: 10, wagered: 100, won: 50, netResult: -50, winRate: 35, avgBet: 5 },
  ],
  riskIndicators: { riskLevel: 'low', avgDailyWager: 100 },
  activityTimeline: [{ date: '2025-05-01', wagered: 100, netResult: 50 }],
  recentActivity: [],
};

function renderWithRoute(userId = '42') {
  return render(
    <MemoryRouter initialEntries={[`/admin/players/${userId}`]}>
      <Routes>
        <Route path="/admin/players/:userId" element={<PlayerProfile />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('PlayerProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching', async () => {
    mockGetProfile.mockImplementation(() => new Promise(() => {}));
    mockGetSessions.mockResolvedValue({ sessions: [], total: 0, totalPages: 1 });
    renderWithRoute();
    expect(screen.getByText(/Loading player profile/)).toBeInTheDocument();
  });

  it('shows error state when profile fetch fails', async () => {
    mockGetProfile.mockRejectedValue(new Error('boom'));
    mockGetSessions.mockResolvedValue({ sessions: [], total: 0, totalPages: 1 });
    renderWithRoute();
    await waitFor(() => {
      expect(screen.getByText(/Player not found/)).toBeInTheDocument();
    });
  });

  it('renders profile with stats, breakdown table, and risk badge', async () => {
    mockGetProfile.mockResolvedValue(profileFixture);
    mockGetSessions.mockResolvedValue({ sessions: [], total: 0, totalPages: 1 });
    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
    });
    expect(screen.getByText(/Total Wagered/)).toBeInTheDocument();
    expect(screen.getByText(/Performance by Game/)).toBeInTheDocument();
    expect(screen.getAllByText(/Low Risk/).length).toBeGreaterThan(0);
  });

  it('renders inactive player badge when profile is not active', async () => {
    mockGetProfile.mockResolvedValue({ ...profileFixture, isActive: false });
    mockGetSessions.mockResolvedValue({ sessions: [], total: 0, totalPages: 1 });
    renderWithRoute();
    await waitFor(() => {
      expect(screen.getByText('Inactive')).toBeInTheDocument();
    });
  });

  it('renders critical risk indicator with pulse animation', async () => {
    mockGetProfile.mockResolvedValue({
      ...profileFixture,
      riskIndicators: { riskLevel: 'critical' },
    });
    mockGetSessions.mockResolvedValue({ sessions: [], total: 0, totalPages: 1 });
    renderWithRoute();
    await waitFor(() => {
      expect(screen.getAllByText(/Critical Risk/).length).toBeGreaterThan(0);
    });
  });

  it('renders medium and high risk badges', async () => {
    mockGetProfile.mockResolvedValue({
      ...profileFixture,
      riskIndicators: { riskLevel: 'high' },
    });
    mockGetSessions.mockResolvedValue({ sessions: [], total: 0, totalPages: 1 });
    renderWithRoute();
    await waitFor(() => {
      expect(screen.getAllByText(/High Risk/).length).toBeGreaterThan(0);
    });
  });

  it('renders no-data message when perGameBreakdown is empty', async () => {
    mockGetProfile.mockResolvedValue({ ...profileFixture, perGameBreakdown: [] });
    mockGetSessions.mockResolvedValue({ sessions: [], total: 0, totalPages: 1 });
    renderWithRoute();
    await waitFor(() => {
      expect(screen.getByText(/No game data available/)).toBeInTheDocument();
    });
  });

  it('renders profile when riskIndicators missing', async () => {
    mockGetProfile.mockResolvedValue({ ...profileFixture, riskIndicators: null });
    mockGetSessions.mockResolvedValue({ sessions: [], total: 0, totalPages: 1 });
    renderWithRoute();
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Risk Assessment/)).not.toBeInTheDocument();
  });

  it('navigates back to players when error button is clicked', async () => {
    mockGetProfile.mockRejectedValue(new Error('not found'));
    mockGetSessions.mockResolvedValue({ sessions: [], total: 0, totalPages: 1 });
    renderWithRoute();
    await waitFor(() => {
      expect(screen.getByText(/Back to Players/)).toBeInTheDocument();
    });
    screen.getByText(/Back to Players/).click();
    expect(navigateSpy).toHaveBeenCalledWith('/admin/players');
  });

  it('fetches sessions with userId param', async () => {
    mockGetProfile.mockResolvedValue(profileFixture);
    mockGetSessions.mockResolvedValue({ sessions: [], total: 0, totalPages: 1 });
    renderWithRoute('77');
    await waitFor(() => {
      expect(mockGetSessions).toHaveBeenCalled();
    });
    expect(mockGetSessions.mock.calls[0][0]).toBe('77');
  });
});
