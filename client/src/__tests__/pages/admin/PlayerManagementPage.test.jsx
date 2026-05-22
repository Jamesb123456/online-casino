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

vi.mock('@/components/admin/PlayerManagement', () => ({
  default: function MockedPlayerManagement() {
    const [rows, setRows] = useState([]);
    useEffect(() => {
      let mounted = true;
      import('@/services/api').then(({ default: api }) => {
        api.get('/admin/users').then((d) => { if (mounted) setRows(d.players || []); });
      });
      return () => { mounted = false; };
    }, []);
    return (
      <div data-testid="player-management-inner">
        {rows.length > 0
          ? <ul data-testid="player-rows">{rows.map((p) => <li key={p.id}>{p.username}</li>)}</ul>
          : 'no-rows'}
      </div>
    );
  },
}));

import PlayerManagementPage from '@/pages/admin/PlayerManagementPage';
import { AuthContext } from '@/contexts/AuthContext';
import AdminGuard from '@/components/guards/AdminGuard';

describe('PlayerManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'admin', role: 'admin' } });
    mockGet.mockResolvedValue({ players: [{ id: 1, username: 'alice' }, { id: 2, username: 'bob' }], totalCount: 2 });
  });

  it('renders the AdminLayout and PlayerManagement inner component', () => {
    render(
      <MemoryRouter>
        <PlayerManagementPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('admin-layout')).toBeInTheDocument();
    expect(screen.getByTestId('player-management-inner')).toBeInTheDocument();
  });

  it('fetches players and populates rendered content', async () => {
    render(
      <MemoryRouter>
        <PlayerManagementPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/admin/users');
    });
    await waitFor(() => {
      expect(screen.getByTestId('player-rows')).toHaveTextContent('alice');
      expect(screen.getByTestId('player-rows')).toHaveTextContent('bob');
    });
  });

  it('AdminGuard blocks non-admin users (redirects to /)', () => {
    render(
      <AuthContext.Provider value={{ user: { id: 9, username: 'bob', role: 'user' }, loading: false, isAuthenticated: true }}>
        <MemoryRouter initialEntries={['/admin/players']}>
          <AdminGuard>
            <PlayerManagementPage />
          </AdminGuard>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.queryByTestId('player-management-inner')).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/');
  });

  it('AdminGuard redirects unauthenticated users to /login', () => {
    render(
      <AuthContext.Provider value={{ user: null, loading: false, isAuthenticated: false }}>
        <MemoryRouter initialEntries={['/admin/players']}>
          <AdminGuard>
            <PlayerManagementPage />
          </AdminGuard>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.queryByTestId('player-management-inner')).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
  });

  it('sets the document title on mount', () => {
    render(
      <MemoryRouter>
        <PlayerManagementPage />
      </MemoryRouter>,
    );
    expect(document.title).toMatch(/Player Management/);
  });
});
