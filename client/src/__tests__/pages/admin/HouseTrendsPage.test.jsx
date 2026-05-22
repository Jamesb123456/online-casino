import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
  default: { get: mockGet, post: mockPost },
  api: { get: mockGet, post: mockPost },
}));

vi.mock('@/components/admin/AdminLayout', () => ({
  default: ({ children }) => <div data-testid="admin-layout">{children}</div>,
}));

vi.mock('@/components/admin/charts/AnalyticsLineChart', () => ({
  default: ({ lines }) => (
    <div data-testid="line-chart">
      {(lines || []).map((l) => (
        <span key={l.dataKey} data-testid={`line-${l.dataKey}`}>{l.name}</span>
      ))}
    </div>
  ),
}));

vi.mock('@/contexts/ToastContext', () => {
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  return { useToast: () => toast };
});

import HouseTrendsPage from '@/pages/admin/HouseTrendsPage';

const sampleSnapshots = [
  {
    id: 1, snapshotDate: '2026-05-17', houseBalanceClose: 500000, totalBets: 1000,
    totalWins: 500, ggr: 500, bonusesPaid: 50, ngr: 450, activePlayerCount: 10, newPlayerCount: 1,
  },
  {
    id: 2, snapshotDate: '2026-05-18', houseBalanceClose: 510000, totalBets: 2000,
    totalWins: 1000, ggr: 1000, bonusesPaid: 100, ngr: 900, activePlayerCount: 12, newPlayerCount: 2,
  },
];

describe('HouseTrendsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'admin', role: 'admin' } });
    mockGet.mockResolvedValue({ from: '2026-04-20', to: '2026-05-19', snapshots: sampleSnapshots });
    mockPost.mockResolvedValue({ snapshot: sampleSnapshots[0] });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <HouseTrendsPage />
      </MemoryRouter>
    );

  it('fetches snapshots on mount with a default 30-day range', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/admin/snapshots', expect.objectContaining({
        params: expect.objectContaining({
          from: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
          to: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        }),
      }));
    });
  });

  it('renders three line charts', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('chart-house-balance')).toBeInTheDocument();
    });
    expect(screen.getByTestId('chart-ggr-ngr')).toBeInTheDocument();
    expect(screen.getByTestId('chart-players')).toBeInTheDocument();
    expect(screen.getByTestId('line-houseBalanceClose')).toBeInTheDocument();
    expect(screen.getByTestId('line-ggr')).toBeInTheDocument();
    expect(screen.getByTestId('line-ngr')).toBeInTheDocument();
    expect(screen.getByTestId('line-activePlayerCount')).toBeInTheDocument();
    expect(screen.getByTestId('line-newPlayerCount')).toBeInTheDocument();
  });

  it('renders a row per snapshot in the table', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('2026-05-17')).toBeInTheDocument();
    });
    expect(screen.getByText('2026-05-18')).toBeInTheDocument();
  });

  it('shows Recompute buttons for admin and POSTs on click', async () => {
    renderPage();
    const buttons = await screen.findAllByRole('button', { name: /Recompute/i });
    expect(buttons.length).toBe(sampleSnapshots.length);

    fireEvent.click(buttons[0]);
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/admin/snapshots/recompute', { date: '2026-05-17' });
    });
  });

  it('hides Recompute buttons for non-admin viewers', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 5, username: 'viewer1', role: 'viewer' } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('2026-05-17')).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Recompute/i })).not.toBeInTheDocument();
  });

  it('refetches when a preset range button is clicked', async () => {
    renderPage();
    await waitFor(() => screen.getByText('2026-05-17'));
    const initialCalls = mockGet.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: /Last 7 days/i }));
    await waitFor(() => {
      expect(mockGet.mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });

  it('shows empty state message when API returns no snapshots', async () => {
    mockGet.mockResolvedValueOnce({ from: '2026-04-20', to: '2026-05-19', snapshots: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/No snapshots in this range/i)).toBeInTheDocument();
    });
  });
});
