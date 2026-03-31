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
// (Navigate with dynamic state causes re-renders when no Routes are defined)
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Navigate: ({ to, replace, state }) => <div data-testid="navigate" data-to={to} />,
  };
});

import { AuthContext } from '@/contexts/AuthContext';
import AuthGuard from '@/components/guards/AuthGuard';

function renderWithAuth(authValue, { route = '/protected' } = {}) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[route]}>
        <AuthGuard>
          <div data-testid="protected-content">Protected Content</div>
        </AuthGuard>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('AuthGuard', () => {
  it('shows loading state while checking auth', () => {
    renderWithAuth({ user: null, loading: true, isAuthenticated: false });

    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(screen.getByTestId('loading')).toHaveTextContent('Verifying authentication...');
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated', () => {
    renderWithAuth({
      user: { id: 1, username: 'testuser', role: 'user' },
      loading: false,
      isAuthenticated: true,
    });

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.getByTestId('protected-content')).toHaveTextContent('Protected Content');
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
  });

  it('redirects to /login when not authenticated', () => {
    renderWithAuth({ user: null, loading: false, isAuthenticated: false });

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
  });

  it('does not render children while loading even if user exists', () => {
    renderWithAuth({
      user: { id: 1, username: 'testuser', role: 'user' },
      loading: true,
      isAuthenticated: true,
    });

    expect(screen.getByTestId('loading')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });
});
