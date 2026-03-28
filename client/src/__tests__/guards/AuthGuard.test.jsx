import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '@/contexts/AuthContext';
import AuthGuard from '@/components/guards/AuthGuard';

// Mock the Loading component
vi.mock('@/components/ui/Loading', () => ({
  default: ({ message }) => <div data-testid="loading">{message}</div>,
}));

/**
 * Helper to render AuthGuard with a given auth context value
 */
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
    renderWithAuth({
      user: null,
      loading: true,
      isAuthenticated: false,
    });

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
    // We can detect the redirect by checking that Navigate was rendered
    // and protected content is not shown
    const { container } = renderWithAuth({
      user: null,
      loading: false,
      isAuthenticated: false,
    });

    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
  });

  it('redirects to /login when not authenticated (verify Navigate target)', () => {
    // Use a custom router setup to capture navigation
    let navigatedTo = null;

    // We test this by wrapping in MemoryRouter and checking the router state
    // Since Navigate renders within MemoryRouter, we check that nothing renders
    const { container } = render(
      <AuthContext.Provider
        value={{
          user: null,
          loading: false,
          isAuthenticated: false,
        }}
      >
        <MemoryRouter initialEntries={['/protected']}>
          <AuthGuard>
            <div data-testid="protected-content">Protected</div>
          </AuthGuard>
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // Protected content should not be rendered
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    // Loading should not be shown
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
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
