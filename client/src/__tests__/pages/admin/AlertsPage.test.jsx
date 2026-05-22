import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const { mockGet, mockPost, mockPut, mockDelete, mockUseAuth } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  default: () => mockUseAuth(),
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/services/api', () => ({
  default: { get: mockGet, post: mockPost, put: mockPut, delete: mockDelete },
  api: { get: mockGet, post: mockPost, put: mockPut, delete: mockDelete },
}));

vi.mock('@/components/admin/AdminLayout', () => ({
  default: ({ children }) => <div data-testid="admin-layout">{children}</div>,
}));

vi.mock('@/contexts/ToastContext', () => {
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  return { useToast: () => toast };
});

import AlertsPage from '@/pages/admin/AlertsPage';

const sampleAlerts = [
  {
    id: 1,
    type: 'big_win',
    severity: 'warning',
    userId: 7,
    gameType: 'crash',
    details: { winAmount: 60_000, threshold: 50_000, message: 'Win of 60000 exceeded big-win threshold' },
    acknowledged: false,
    createdAt: '2026-05-19T10:00:00.000Z',
  },
  {
    id: 2,
    type: 'house_low',
    severity: 'critical',
    userId: null,
    gameType: null,
    details: { balance: 50_000, threshold: 100_000, message: 'House balance fell below threshold' },
    acknowledged: true,
    createdAt: '2026-05-19T11:00:00.000Z',
  },
];

describe('AlertsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'admin', role: 'admin' } });
    mockGet.mockImplementation((url) => {
      if (url === '/admin/alerts') {
        return Promise.resolve({ rows: sampleAlerts, total: 2, unreadCount: 1 });
      }
      if (url === '/admin/alerts/settings') {
        return Promise.resolve({ bigWin: 50_000, houseLow: 100_000, rapidBetsPerMin: 30 });
      }
      return Promise.resolve({});
    });
    mockPost.mockResolvedValue({ ok: true, count: 1 });
    mockPut.mockResolvedValue({ bigWin: 75_000, houseLow: 100_000, rapidBetsPerMin: 30 });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <AlertsPage />
      </MemoryRouter>
    );

  it('renders all sections for admins', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('alerts-filter-card')).toBeInTheDocument();
    });
    expect(screen.getByTestId('alerts-list-card')).toBeInTheDocument();
    expect(screen.getByTestId('alerts-thresholds-card')).toBeInTheDocument();
  });

  it('loads alerts and thresholds on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/admin/alerts', expect.any(Object));
      expect(mockGet).toHaveBeenCalledWith('/admin/alerts/settings');
    });
  });

  it('displays the unread count pill when unreadCount > 0', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('unread-count-pill')).toHaveTextContent('1 unread');
    });
  });

  it('renders an Acknowledge button per unacknowledged row and calls the endpoint', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('ack-btn-1')).toBeInTheDocument();
    });
    // Acknowledged row should NOT have a button
    expect(screen.queryByTestId('ack-btn-2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('ack-btn-1'));
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/admin/alerts/1/acknowledge');
    });
  });

  it('hides Acknowledge buttons for viewer role', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'view', role: 'viewer' } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('alerts-list-card')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('ack-btn-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('ack-all-btn')).not.toBeInTheDocument();
  });

  it('calls acknowledge-all when the button is clicked', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('ack-all-btn')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('ack-all-btn'));
    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/admin/alerts/acknowledge-all');
    });
  });
});
