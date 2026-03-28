import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '@/pages/LoginPage';

const { mockNavigate, mockLogin } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockLogin: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/layouts/MainLayout', () => ({
  default: ({ children }) => <div data-testid="main-layout">{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: {
    $$typeof: Symbol.for('react.context'),
    _currentValue: {
      login: mockLogin,
    },
    Provider: ({ value, children }) => children,
    Consumer: ({ children }) => children({}),
  },
}));

// We need to provide the context value directly via React.createContext
// Let's use a wrapper approach instead
import React from 'react';
import { AuthContext } from '@/contexts/AuthContext';

const renderLoginPage = (contextOverrides = {}) => {
  const contextValue = {
    user: null,
    loading: false,
    isAuthenticated: false,
    login: mockLogin,
    logout: vi.fn(),
    register: vi.fn(),
    updateBalance: vi.fn(),
    error: null,
    ...contextOverrides,
  };

  return render(
    <MemoryRouter>
      <AuthContext.Provider value={contextValue}>
        <LoginPage />
      </AuthContext.Provider>
    </MemoryRouter>
  );
};

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the login form with username and password fields', () => {
    renderLoginPage();
    expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders the submit button with "Sign In" text', () => {
    renderLoginPage();
    expect(
      screen.getByRole('button', { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it('renders branding text', () => {
    renderLoginPage();
    expect(screen.getByText('Platinum')).toBeInTheDocument();
    expect(screen.getByText(/sign in to your account/i)).toBeInTheDocument();
  });

  it('renders a link to the register page', () => {
    renderLoginPage();
    const registerLink = screen.getByRole('link', {
      name: /create account/i,
    });
    expect(registerLink).toBeInTheDocument();
    expect(registerLink).toHaveAttribute('href', '/register');
  });

  it('allows typing in username and password fields', async () => {
    const user = userEvent.setup();
    renderLoginPage();

    const usernameInput = screen.getByLabelText(/username/i);
    const passwordInput = screen.getByLabelText(/password/i);

    await user.type(usernameInput, 'testuser');
    await user.type(passwordInput, 'testpass');

    expect(usernameInput).toHaveValue('testuser');
    expect(passwordInput).toHaveValue('testpass');
  });

  it('calls login with form data on submit', async () => {
    mockLogin.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'user' });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'testpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        username: 'testuser',
        password: 'testpass',
      });
    });
  });

  it('navigates to home page after successful login for regular user', async () => {
    mockLogin.mockResolvedValueOnce({ id: 1, username: 'testuser', role: 'user' });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'testpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('navigates to admin dashboard after successful login for admin user', async () => {
    mockLogin.mockResolvedValueOnce({ id: 1, username: 'admin', role: 'admin' });
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/username/i), 'admin');
    await user.type(screen.getByLabelText(/password/i), 'adminpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard');
    });
  });

  it('displays an error message on failed login', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/username/i), 'baduser');
    await user.type(screen.getByLabelText(/password/i), 'badpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('shows loading state during form submission', async () => {
    // Login that never resolves during the test
    let resolveLogin;
    mockLogin.mockImplementation(
      () => new Promise((resolve) => { resolveLogin = resolve; })
    );
    const user = userEvent.setup();
    renderLoginPage();

    await user.type(screen.getByLabelText(/username/i), 'testuser');
    await user.type(screen.getByLabelText(/password/i), 'testpass');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
    });

    // The button should be disabled during loading
    const submitButton = screen.getByRole('button');
    expect(submitButton).toBeDisabled();

    // Clean up
    resolveLogin({ id: 1, username: 'testuser', role: 'user' });
  });

  it('renders the security notice text', () => {
    renderLoginPage();
    expect(
      screen.getByText(/secure, encrypted connection/i)
    ).toBeInTheDocument();
  });

  it('has required attributes on username and password inputs', () => {
    renderLoginPage();
    expect(screen.getByLabelText(/username/i)).toBeRequired();
    expect(screen.getByLabelText(/password/i)).toBeRequired();
  });

  it('password field has type="password"', () => {
    renderLoginPage();
    expect(screen.getByLabelText(/password/i)).toHaveAttribute(
      'type',
      'password'
    );
  });
});
