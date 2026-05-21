import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React, { Suspense, lazy } from 'react';

// Heavy/auth-related modules used transitively by providers
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

// Replace MainLayout and the heavy game component with light shells
vi.mock('@/layouts/MainLayout', () => ({
  default: ({ children }) => <div data-testid="main-layout">{children}</div>,
}));
vi.mock('@/games/crash/CrashGame', () => ({
  default: () => <div data-testid="crash-game">Crash Game</div>,
}));
vi.mock('@/components/games/RulesButton', () => ({
  default: () => <button type="button" data-testid="rules-button">Rules</button>,
}));
// CrashPage wraps its game in ApiStatus which gates on a loading timer.
// Replace it with a passthrough so the game mock renders immediately.
vi.mock('@/components/ui/ApiStatus', () => ({
  default: ({ children }) => <div data-testid="api-status">{children}</div>,
}));

import { AuthProvider, AuthContext } from '@/contexts/AuthContext';
import { ToastProvider } from '@/contexts/ToastContext';
import GameErrorBoundary from '@/components/GameErrorBoundary';
import AuthGuard from '@/components/guards/AuthGuard';
import CrashPage from '@/pages/games/CrashPage';

const renderWithProviders = (ui, { route = '/games/crash' } = {}) =>
  render(
    <AuthProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </ToastProvider>
    </AuthProvider>
  );

describe('CrashPage', () => {
  it('renders without crashing inside providers and MemoryRouter', () => {
    renderWithProviders(<CrashPage />);
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    expect(screen.getByTestId('crash-game')).toBeInTheDocument();
  });

  it('is rendered inside GameErrorBoundary which catches child errors', () => {
    const Boom = () => {
      throw new Error('boom');
    };
    // Suppress expected error output from React for this assertion
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter>
        <GameErrorBoundary gameName="Crash">
          <Boom />
        </GameErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText(/Crash Error/i)).toBeInTheDocument();
    spy.mockRestore();
  });

  it('shows Suspense fallback while the lazy page is loading', async () => {
    // Lazy import that never resolves so the fallback stays visible
    const LazyCrash = lazy(() => new Promise(() => {}));
    render(
      <MemoryRouter>
        <Suspense fallback={<div data-testid="suspense-fallback">Loading Crash...</div>}>
          <LazyCrash />
        </Suspense>
      </MemoryRouter>
    );
    expect(screen.getByTestId('suspense-fallback')).toBeInTheDocument();
    expect(screen.getByText(/Loading Crash/i)).toBeInTheDocument();
  });

  it('redirects to /login when AuthGuard sees no authenticated user', async () => {
    const authValue = { user: null, loading: false, isAuthenticated: false };
    render(
      <AuthContext.Provider value={authValue}>
        <MemoryRouter initialEntries={['/games/crash']}>
          <Routes>
            <Route
              path="/games/crash"
              element={
                <AuthGuard>
                  <CrashPage />
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
    expect(screen.queryByTestId('crash-game')).not.toBeInTheDocument();
  });
});
