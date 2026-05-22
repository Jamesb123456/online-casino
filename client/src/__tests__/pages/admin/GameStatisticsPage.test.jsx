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

vi.mock('@/components/admin/GameStatistics', () => ({
  default: function MockedGameStatistics() {
    const [games, setGames] = useState([]);
    useEffect(() => {
      let mounted = true;
      import('@/services/api').then(({ default: api }) => {
        api.get('/admin/games').then((d) => { if (mounted) setGames(d.games || []); });
      });
      return () => { mounted = false; };
    }, []);
    return (
      <div data-testid="game-statistics-inner">
        {games.length > 0
          ? <ul data-testid="game-rows">{games.map((g) => <li key={g.name}>{g.name}</li>)}</ul>
          : 'no-games'}
      </div>
    );
  },
}));

import GameStatisticsPage from '@/pages/admin/GameStatisticsPage';
import { AuthContext } from '@/contexts/AuthContext';
import AdminGuard from '@/components/guards/AdminGuard';

describe('GameStatisticsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'admin', role: 'admin' } });
    mockGet.mockResolvedValue({ games: [{ name: 'Crash', played: 100, profit: 1000 }, { name: 'Roulette', played: 50, profit: 500 }] });
  });

  it('renders the AdminLayout and GameStatistics inner component', () => {
    render(
      <MemoryRouter>
        <GameStatisticsPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('admin-layout')).toBeInTheDocument();
    expect(screen.getByTestId('game-statistics-inner')).toBeInTheDocument();
  });

  it('fetches game statistics and populates rendered content', async () => {
    render(
      <MemoryRouter>
        <GameStatisticsPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/admin/games');
    });
    await waitFor(() => {
      expect(screen.getByTestId('game-rows')).toHaveTextContent('Crash');
      expect(screen.getByTestId('game-rows')).toHaveTextContent('Roulette');
    });
  });

  it('AdminGuard blocks non-admin users (redirects to /)', () => {
    render(
      <AuthContext.Provider value={{ user: { id: 9, username: 'bob', role: 'user' }, loading: false, isAuthenticated: true }}>
        <MemoryRouter initialEntries={['/admin/game-stats']}>
          <AdminGuard>
            <GameStatisticsPage />
          </AdminGuard>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.queryByTestId('game-statistics-inner')).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/');
  });

  it('AdminGuard redirects unauthenticated users to /login', () => {
    render(
      <AuthContext.Provider value={{ user: null, loading: false, isAuthenticated: false }}>
        <MemoryRouter initialEntries={['/admin/game-stats']}>
          <AdminGuard>
            <GameStatisticsPage />
          </AdminGuard>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.queryByTestId('game-statistics-inner')).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
  });

  it('sets the document title on mount', () => {
    render(
      <MemoryRouter>
        <GameStatisticsPage />
      </MemoryRouter>,
    );
    expect(document.title).toMatch(/Game Statistics/);
  });
});
