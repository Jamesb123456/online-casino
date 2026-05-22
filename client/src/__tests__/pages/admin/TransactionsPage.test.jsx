import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const { mockGet, mockGetTransactions, mockUseAuth } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockGetTransactions: vi.fn(),
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

vi.mock('@/services/admin/transactionService', () => ({
  default: {
    getTransactions: mockGetTransactions,
    createTransaction: vi.fn(),
    voidTransaction: vi.fn(),
  },
}));

// CreateTransactionForm has heavy deps; replace with a sentinel for page-level test
vi.mock('@/components/admin/CreateTransactionForm', () => ({
  default: () => <div data-testid="create-transaction-form" />,
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

import TransactionsPage from '@/pages/admin/TransactionsPage';
import { AuthContext } from '@/contexts/AuthContext';
import AdminGuard from '@/components/guards/AdminGuard';

const sampleTx = [
  { id: 'TX100', userId: 1, userUsername: 'alice', type: 'deposit', amount: 500, createdAt: '2026-05-19T00:00:00.000Z', status: 'completed' },
  { id: 'TX101', userId: 2, userUsername: 'bob', type: 'withdrawal', amount: -250, createdAt: '2026-05-19T01:00:00.000Z', status: 'pending' },
];

describe('TransactionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'admin', role: 'admin' } });
    mockGetTransactions.mockResolvedValue({ transactions: sampleTx, total: sampleTx.length });
  });

  it('renders the AdminLayout and Transactions heading', async () => {
    render(
      <MemoryRouter>
        <TransactionsPage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('admin-layout')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Transactions/i })).toBeInTheDocument();
  });

  it('fetches transactions on mount and populates rendered table content', async () => {
    render(
      <MemoryRouter>
        <TransactionsPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(mockGetTransactions).toHaveBeenCalledWith(expect.objectContaining({ page: 1, limit: 5 }));
    });
    await waitFor(() => {
      expect(screen.getByText('TX100')).toBeInTheDocument();
      expect(screen.getByText('TX101')).toBeInTheDocument();
      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
    });
  });

  it('AdminGuard blocks non-admin users (redirects to /)', () => {
    render(
      <AuthContext.Provider value={{ user: { id: 9, username: 'bob', role: 'user' }, loading: false, isAuthenticated: true }}>
        <MemoryRouter initialEntries={['/admin/transactions']}>
          <AdminGuard>
            <TransactionsPage />
          </AdminGuard>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.queryByRole('heading', { name: /^Transactions$/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/');
  });

  it('AdminGuard redirects unauthenticated users to /login', () => {
    render(
      <AuthContext.Provider value={{ user: null, loading: false, isAuthenticated: false }}>
        <MemoryRouter initialEntries={['/admin/transactions']}>
          <AdminGuard>
            <TransactionsPage />
          </AdminGuard>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    expect(screen.queryByRole('heading', { name: /^Transactions$/ })).not.toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
  });

  it('sets the document title on mount', () => {
    render(
      <MemoryRouter>
        <TransactionsPage />
      </MemoryRouter>,
    );
    expect(document.title).toMatch(/Transactions/);
  });

  it('renders pagination total count from API response', async () => {
    render(
      <MemoryRouter>
        <TransactionsPage />
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText(/Showing 2 of 2 transactions/i)).toBeInTheDocument();
    });
  });
});
