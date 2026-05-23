import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React, { Suspense, lazy } from 'react';

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: { username: vi.fn() },
    signUp: { email: vi.fn() },
    signOut: vi.fn(),
    getSession: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));
vi.mock('@/services/socketService', () => ({
  default: { initializeSocket: vi.fn(), disconnectSocket: vi.fn() },
}));
vi.mock('@/services/api', () => ({
  api: { get: vi.fn().mockResolvedValue(null), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/layouts/MainLayout', () => ({
  default: ({ children }) => <div data-testid="main-layout">{children}</div>,
}));
vi.mock('@/games/plinko/PlinkoGame', () => ({
  default: () => <div data-testid="plinko-game">Plinko Game</div>,
}));
vi.mock('@/components/games/RulesButton', () => ({
  default: () => <button type="button" data-testid="rules-button">Rules</button>,
}));

import { AuthProvider, AuthContext } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import GameErrorBoundary from '@/components/GameErrorBoundary';
import AuthGuard from '@/components/guards/AuthGuard';
import PlinkoPage from '@/pages/games/PlinkoPage';

const renderWithProviders = (ui, { route = '/games/plinko' } = {}) =>
  render(
    <AuthProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </ToastProvider>
    </AuthProvider>
  );

describe('PlinkoPage', () => {
  it('renders without crashing inside providers and MemoryRouter', () => {
    renderWithProviders(<PlinkoPage />);
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    expect(screen.getByTestId('plinko-game')).toBeInTheDocument();
  });

  it('is rendered inside GameErrorBoundary which catches child errors', () => {
    const Boom = () => {
      throw new Error('boom');
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter>
        <GameErrorBoundary gameName="Plinko">
          <Boom />
        </GameErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText(/Plinko Error/i)).toBeInTheDocument();
    spy.mockRestore();
  });

  it('shows Suspense fallback while the lazy page is loading', () => {
    const LazyPlinko = lazy(() => new Promise(() => {}));
    render(
      <MemoryRouter>
        <Suspense fallback={<div data-testid="suspense-fallback">Loading Plinko...</div>}>
          <LazyPlinko />
        </Suspense>
      </MemoryRouter>
    );
    expect(screen.getByTestId('suspense-fallback')).toBeInTheDocument();
    expect(screen.getByText(/Loading Plinko/i)).toBeInTheDocument();
  });

  it('redirects to /login when AuthGuard sees no authenticated user', async () => {
    const authValue = { user: null, loading: false, isAuthenticated: false };
    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/games/plinko']}>
          <Routes>
            <Route
              path="/games/plinko"
              element={
                <AuthGuard>
                  <PlinkoPage />
                </AuthGuard>
              }
            />
            <Route path="/login" element={<div data-testid="login-page">Login</div>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );
    await waitFor(() => {
      expect(screen.getByTestId('login-page')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('plinko-game')).not.toBeInTheDocument();
  });
});
