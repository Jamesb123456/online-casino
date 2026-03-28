import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { AuthProvider, AuthContext } from '@/contexts/AuthContext';

// ---- Mocks ----

const mockSignIn = vi.fn();
const mockSignUp = vi.fn();
const mockSignOut = vi.fn();
const mockGetSession = vi.fn();

vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: { username: (...args) => mockSignIn(...args) },
    signUp: { email: (...args) => mockSignUp(...args) },
    signOut: (...args) => mockSignOut(...args),
    getSession: (...args) => mockGetSession(...args),
  },
}));

const mockInitializeSocket = vi.fn();
const mockDisconnectSocket = vi.fn();

vi.mock('@/services/socketService', () => ({
  default: {
    initializeSocket: (...args) => mockInitializeSocket(...args),
    disconnectSocket: (...args) => mockDisconnectSocket(...args),
  },
}));

const mockApiGet = vi.fn();

vi.mock('@/services/api', () => ({
  api: {
    get: (...args) => mockApiGet(...args),
  },
}));

// ---- Test helper component ----

function TestComponent({ onRender } = {}) {
  const ctx = React.useContext(AuthContext);
  // Allow tests to capture the full context object
  if (onRender) onRender(ctx);
  return (
    <div>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="user">{ctx.user ? ctx.user.username : 'none'}</span>
      <span data-testid="isAuthenticated">{String(ctx.isAuthenticated)}</span>
      <span data-testid="error">{ctx.error || 'none'}</span>
      <span data-testid="balance">{ctx.user ? String(ctx.user.balance) : 'none'}</span>
      <button data-testid="login" onClick={() => ctx.login({ username: 'testuser', password: 'pass123' }).catch(() => {})}>
        Login
      </button>
      <button data-testid="logout" onClick={() => ctx.logout()}>
        Logout
      </button>
      <button
        data-testid="register"
        onClick={() => ctx.register({ username: 'newuser', password: 'pass123' }).catch(() => {})}
      >
        Register
      </button>
      <button data-testid="updateBalance" onClick={() => ctx.updateBalance(999)}>
        Update Balance
      </button>
    </div>
  );
}

// ---- Tests ----

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no session on init
    mockGetSession.mockResolvedValue({ data: null, error: null });
  });

  it('renders children', async () => {
    render(
      <AuthProvider>
        <span data-testid="child">hello</span>
      </AuthProvider>
    );
    expect(screen.getByTestId('child')).toHaveTextContent('hello');
  });

  it('has correct initial state: user is null, loading is true, isAuthenticated is false', () => {
    // Use a synchronous capture before any effects run
    let captured;
    mockGetSession.mockReturnValue(new Promise(() => {})); // never resolves, keeps loading true

    render(
      <AuthProvider>
        <TestComponent onRender={(ctx) => { if (!captured) captured = ctx; }} />
      </AuthProvider>
    );

    // The very first render should have loading=true, user=null
    expect(captured.loading).toBe(true);
    expect(captured.user).toBeNull();
    expect(captured.isAuthenticated).toBe(false);
  });

  it('after init with no session: loading becomes false, user stays null', async () => {
    mockGetSession.mockResolvedValue({ data: null, error: null });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
  });

  it('after init with valid session: fetches user from API and sets user', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        user: { id: '1', username: 'sessionuser', role: 'user', balance: '100' },
      },
      error: null,
    });
    mockApiGet.mockResolvedValue({
      id: 1,
      username: 'sessionuser',
      role: 'user',
      balance: 100,
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
    expect(screen.getByTestId('user')).toHaveTextContent('sessionuser');
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
    expect(mockApiGet).toHaveBeenCalledWith('/users/me');
  });

  it('after init with valid session but API failure: falls back to mapped session user', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        user: { id: '5', username: 'fallbackuser', role: 'user', balance: '50' },
      },
      error: null,
    });
    mockApiGet.mockRejectedValue(new Error('API down'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
    expect(screen.getByTestId('user')).toHaveTextContent('fallbackuser');
    expect(screen.getByTestId('balance')).toHaveTextContent('50');
  });

  it('login() - successful login updates user state', async () => {
    const user = userEvent.setup();

    mockGetSession.mockResolvedValue({ data: null, error: null });
    mockSignIn.mockResolvedValue({
      data: { user: { id: '1', username: 'testuser', role: 'user', balance: '200' } },
      error: null,
    });
    mockApiGet.mockResolvedValue({
      id: 1,
      username: 'testuser',
      role: 'user',
      balance: 200,
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // Wait for init to finish
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByTestId('login'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('testuser');
    });
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
    expect(mockSignIn).toHaveBeenCalledWith({
      username: 'testuser',
      password: 'pass123',
    });
    expect(mockDisconnectSocket).toHaveBeenCalled();
    expect(mockInitializeSocket).toHaveBeenCalled();
  });

  it('login() - failed login sets error', async () => {
    const user = userEvent.setup();

    mockGetSession.mockResolvedValue({ data: null, error: null });
    mockSignIn.mockResolvedValue({
      data: null,
      error: { message: 'Invalid credentials' },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByTestId('login'));

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Invalid credentials');
    });
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
  });

  it('logout() - clears user state, sets isAuthenticated to false', async () => {
    const user = userEvent.setup();

    // Start with a logged-in session
    mockGetSession.mockResolvedValue({
      data: { user: { id: '1', username: 'loggeduser', role: 'user', balance: '100' } },
      error: null,
    });
    mockApiGet.mockResolvedValue({
      id: 1,
      username: 'loggeduser',
      role: 'user',
      balance: 100,
    });
    mockSignOut.mockResolvedValue({});

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('loggeduser');
    });

    await user.click(screen.getByTestId('logout'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('none');
    });
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
    expect(mockSignOut).toHaveBeenCalled();
    expect(mockDisconnectSocket).toHaveBeenCalled();
  });

  it('register() - successful registration', async () => {
    const user = userEvent.setup();

    mockGetSession.mockResolvedValue({ data: null, error: null });
    mockSignUp.mockResolvedValue({
      data: { user: { id: '2', username: 'newuser', role: 'user', balance: '0' } },
      error: null,
    });
    mockApiGet.mockResolvedValue({
      id: 2,
      username: 'newuser',
      role: 'user',
      balance: 0,
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByTestId('register'));

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('newuser');
    });
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true');
    expect(mockSignUp).toHaveBeenCalledWith({
      email: 'newuser@platinum.local',
      password: 'pass123',
      name: 'newuser',
      username: 'newuser',
    });
  });

  it('register() - failed registration sets error', async () => {
    const user = userEvent.setup();

    mockGetSession.mockResolvedValue({ data: null, error: null });
    mockSignUp.mockResolvedValue({
      data: null,
      error: { message: 'Username already taken' },
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByTestId('register'));

    await waitFor(() => {
      expect(screen.getByTestId('error')).toHaveTextContent('Username already taken');
    });
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('updateBalance() - updates user.balance', async () => {
    const user = userEvent.setup();

    mockGetSession.mockResolvedValue({
      data: { user: { id: '1', username: 'richuser', role: 'user', balance: '500' } },
      error: null,
    });
    mockApiGet.mockResolvedValue({
      id: 1,
      username: 'richuser',
      role: 'user',
      balance: 500,
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('balance')).toHaveTextContent('500');
    });

    await user.click(screen.getByTestId('updateBalance'));

    await waitFor(() => {
      expect(screen.getByTestId('balance')).toHaveTextContent('999');
    });
    // User object should still exist
    expect(screen.getByTestId('user')).toHaveTextContent('richuser');
  });

  it('mapUser() correctly maps session user to app user shape', async () => {
    // Test via the fallback path where api.get fails and mapUser is used
    mockGetSession.mockResolvedValue({
      data: {
        user: {
          id: '42',
          username: 'mapped',
          name: 'Mapped Name',
          role: 'admin',
          balance: '123.45',
          isActive: true,
        },
      },
      error: null,
    });
    mockApiGet.mockRejectedValue(new Error('fail'));

    let capturedCtx;
    render(
      <AuthProvider>
        <TestComponent onRender={(ctx) => { capturedCtx = ctx; }} />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(capturedCtx.loading).toBe(false);
    });

    const mappedUser = capturedCtx.user;
    expect(mappedUser.id).toBe(42);
    expect(mappedUser.username).toBe('mapped');
    expect(mappedUser.role).toBe('admin');
    expect(mappedUser.balance).toBe(123.45);
    expect(mappedUser.isActive).toBe(true);
  });

  it('mapUser() uses name as fallback when username is missing', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        user: {
          id: '7',
          name: 'NameFallback',
          role: 'user',
          balance: '0',
        },
      },
      error: null,
    });
    mockApiGet.mockRejectedValue(new Error('fail'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('NameFallback');
    });
  });

  it('isAuthenticated reflects user presence', async () => {
    // No session = not authenticated
    mockGetSession.mockResolvedValue({ data: null, error: null });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false');
  });

  it('init handles thrown exceptions gracefully', async () => {
    mockGetSession.mockRejectedValue(new Error('Network down'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });
    expect(screen.getByTestId('user')).toHaveTextContent('none');
    expect(screen.getByTestId('error')).toHaveTextContent('none');
  });
});
