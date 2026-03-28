import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '@/contexts/AuthContext';
import AdminGuard from '@/components/guards/AdminGuard';

// Mock the Loading component
vi.mock('@/components/ui/Loading', () => ({
  default: ({ message }) => <div data-testid="loading">{message}</div>,
}));

/**
 * Helper to render AdminGuard with a given auth context value
 */
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
    renderWithAuth({
      user: null,
      loading: true,
      isAuthenticated: false,
    });

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
    renderWithAuth({
      user: null,
      loading: false,
      isAuthenticated: false,
    });

    // Neither admin content nor loading should be shown
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
  });

  it('redirects to / when authenticated but not admin', () => {
    renderWithAuth({
      user: { id: 2, username: 'regularuser', role: 'user' },
      loading: false,
      isAuthenticated: true,
    });

    // Admin content should not be shown - user is redirected to /
    expect(screen.queryByTestId('admin-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
  });

  it('redirects to / when authenticated but user object is null', () => {
    // Edge case: isAuthenticated true but user null
    renderWithAuth({
      user: null,
      loading: false,
      isAuthenticated: true,
    });

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
