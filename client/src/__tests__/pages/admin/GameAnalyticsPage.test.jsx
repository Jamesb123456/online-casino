import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React, { useEffect, useState } from 'react';

const { mockGet, mockUseAuth } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  default: () => mockUseAuth(),
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/lib/auth-client', () => ({
  authClient: { signIn: { username: vi.fn() }, signUp: { email: vi.fn() }, signOut: vi.fn(), getSession: vi.fn() },
}));
vi.mock('@/services/socketService', () => ({ default: { initializeSocket: vi.fn(), disconnectSocket: vi.fn() } }));

vi.mock('@/services/api', () => ({
  default: { get: mockGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  api: { get: mockGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/components/admin/AdminLayout', () => ({
  default: ({ children }) => <div data-testid="admin-layout">{children}</div>,
}));

vi.mock('@/components/ui/Loading', () => ({
  default: ({ message }) => <div data-testid="loading">{message}</div>,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Navigate: ({ to }) => <div data-testid="navigate" data-to={to} />,
  };
});

vi.mock('@/components/admin/GameAnalytics', () => ({
  default: function MockedGameAnalytics() {
    const [data, setData] = useState(null);
    useEffect(() => {
      let mounted = true;
      import('@/services/api').then(({ default: api }) => {
        api.get('/admin/analytics/games').then((d) => { if (mounted) setData(d); });
      });
      return () => { mounted = false; };
    }, []);
    return (
      <div data-testid="game-analytics-inner">
        {data ? <div data-testid="game-analytics-data">{data.totalRevenue}</div> : 'loading'}
      </div>
    );
  },
}));

import GameAnalyticsPage from '@/pages/admin/GameAnalyticsPage';
import { AuthContext } from '@/contexts/AuthContext';
import AdminGuard from '@/components/guards/AdminGuard';

describe('GameAnalyticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'admin', role: 'admin' } });
    mockGet.mockResolvedValue({ totalRevenue: 50000, games: [] });
  });

  it('renders the AdminLayout and GameAnalytics inner component', () => {
    render(
      <MemoryRouter>
        <GameAnalyticsPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('admin-layout')).toBeInTheDocument();
    expect(screen.getByTestId('game-analytics-inner')).toBeInTheDocument();
  });

  it('fetches analytics data and populates rendered content', async () => {
    render(
      <MemoryRouter>
        <GameAnalyticsPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/admin/analytics/games');
    });
    await waitFor(() => {
      expect(screen.getByTestId('game-analytics-data')).toHaveTextContent('50000');
    });
  });

  it('AdminGuard blocks non-admin users (redirects to /)', () => {
    render(
      <AuthContext.Provider value={{ user: { id: 9, username: 'bob', role: 'user' }, loading: false, isAuthenticated: true }}>
        <MemoryRouter initialEntries={['/admin/analytics/games']}>
          <AdminGuard>
            <GameAnalyticsPage />
          </AdminGuard>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.queryByTestId('game-analytics-inner')).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/');
  });

  it('AdminGuard redirects unauthenticated users to /login', () => {
    render(
      <AuthContext.Provider value={{ user: null, loading: false, isAuthenticated: false }}>
        <MemoryRouter initialEntries={['/admin/analytics/games']}>
          <AdminGuard>
            <GameAnalyticsPage />
          </AdminGuard>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.queryByTestId('game-analytics-inner')).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
  });

  it('sets the document title on mount', () => {
    render(
      <MemoryRouter>
        <GameAnalyticsPage />
      </MemoryRouter>,
    );
    expect(document.title).toMatch(/Game Analytics/);
  });
});
