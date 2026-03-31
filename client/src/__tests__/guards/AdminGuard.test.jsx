import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

// Mock heavy dependencies that AuthContext imports
vi.mock('@/lib/auth-client', () => ({
  authClient: { signIn: { username: vi.fn() }, signUp: { email: vi.fn() }, signOut: vi.fn(), getSession: vi.fn() },
}));
vi.mock('@/services/socketService', () => ({ default: { initializeSocket: vi.fn(), disconnectSocket: vi.fn() } }));
vi.mock('@/services/api', () => ({ api: { get: vi.fn() } }));

// Mock Loading component
vi.mock('@/components/ui/Loading', () => ({
  default: ({ message }) => <div data-testid="loading">{message}</div>,
}));

// Mock Navigate to prevent infinite render loop in tests
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Navigate: ({ to, replace, state }) => <div data-testid="navigate" data-to={to} />,
  };
});

import { AuthContext } from '@/contexts/AuthContext';
import AdminGuard from '@/components/guards/AdminGuard';

function renderWithAuth(authValue, { route = '/admin' } = {}) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[route]}>
        <AdminGuard>
          <div data-testid="admin-content">Admin Dashboard</div>
        </AdminGuard>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('AdminGuard', () => {
  it('shows loading state while checking auth', () => {
    renderWithAuth({ user: null, loading: true, isAuthenticated: false });

    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(screen.getByTestId('loading')).toHaveTextContent('Verifying admin access...');
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
  });

  it('renders children when user is admin', () => {
    renderWithAuth({
      user: { id: 1, username: 'admin', role: 'admin' },
      loading: false,
      isAuthenticated: true,
    });

    expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    expect(screen.getByTestId('admin-content')).toHaveTextContent('Admin Dashboard');
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    renderWithAuth({ user: null, loading: false, isAuthenticated: false });

    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
  });

  it('redirects to / when authenticated but not admin', () => {
    renderWithAuth({
      user: { id: 2, username: 'regularuser', role: 'user' },
      loading: false,
      isAuthenticated: true,
    });

    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/');
  });

  it('redirects to / when authenticated but user object is null', () => {
    renderWithAuth({ user: null, loading: false, isAuthenticated: true });
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
  });

  it('does not render children while loading even if user is admin', () => {
    renderWithAuth({
      user: { id: 1, username: 'admin', role: 'admin' },
      loading: true,
      isAuthenticated: true,
    });

    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
  });

  it('rejects user with non-admin role', () => {
    renderWithAuth({
      user: { id: 3, username: 'moderator', role: 'moderator' },
      loading: false,
      isAuthenticated: true,
    });

    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
  });
});
