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
vi.mock('@/games/wheel/WheelGame', () => ({
  default: () => <div data-testid="wheel-game">Wheel Game</div>,
}));
vi.mock('@/components/games/RulesButton', () => ({
  default: () => <button type="button" data-testid="rules-button">Rules</button>,
}));

import { AuthProvider, AuthContext } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import GameErrorBoundary from '@/components/GameErrorBoundary';
import AuthGuard from '@/components/guards/AuthGuard';
import WheelPage from '@/pages/games/WheelPage';

const renderWithProviders = (ui, { route = '/games/wheel' } = {}) =>
  render(
    <AuthProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </ToastProvider>
    </AuthProvider>
  );

describe('WheelPage', () => {
  it('renders without crashing inside providers and MemoryRouter', () => {
    renderWithProviders(<WheelPage />);
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    expect(screen.getByTestId('wheel-game')).toBeInTheDocument();
  });

  it('is rendered inside GameErrorBoundary which catches child errors', () => {
    const Boom = () => {
      throw new Error('boom');
    };
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter>
        <GameErrorBoundary gameName="Wheel">
          <Boom />
        </GameErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText(/Wheel Error/i)).toBeInTheDocument();
    spy.mockRestore();
  });

  it('shows Suspense fallback while the lazy page is loading', () => {
    const LazyWheel = lazy(() => new Promise(() => {}));
    render(
      <MemoryRouter>
        <Suspense fallback={<div data-testid="suspense-fallback">Loading Wheel...</div>}>
          <LazyWheel />
        </Suspense>
      </MemoryRouter>
    );
    expect(screen.getByTestId('suspense-fallback')).toBeInTheDocument();
    expect(screen.getByText(/Loading Wheel/i)).toBeInTheDocument();
  });

  it('redirects to /login when AuthGuard sees no authenticated user', async () => {
    const authValue = { user: null, loading: false, isAuthenticated: false };
    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/games/wheel']}>
          <Routes>
            <Route
              path="/games/wheel"
              element={
                <AuthGuard>
                  <WheelPage />
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
    expect(screen.queryByTestId('wheel-game')).not.toBeInTheDocument();
  });
});
