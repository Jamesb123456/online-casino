import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const { mockGet, mockPost, mockPut, mockUseAuth } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('@/hooks/useAuth', () => ({
  default: () => mockUseAuth(),
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/services/api', () => ({
  default: { get: mockGet, post: mockPost, put: mockPut },
  api: { get: mockGet, post: mockPost, put: mockPut },
}));

vi.mock('@/components/admin/AdminLayout', () => ({
  default: ({ children }) => <div data-testid="admin-layout">{children}</div>,
}));

vi.mock('@/contexts/ToastContext', () => {
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  return { useToast: () => toast };
});

import HousePage from '@/pages/admin/HousePage';

describe('HousePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'admin', role: 'admin' } });
    mockGet.mockImplementation((url) => {
      if (url === '/admin/house') {
        return Promise.resolve({
          balance: 750000,
          caps: { perRound: 1000000, perUserPerDay: 10000000, perDay: null },
        });
      }
      if (url === '/admin/house/transactions') {
        return Promise.resolve({
          rows: [
            {
              id: 1,
              type: 'admin_topup',
              amount: 500000,
              balanceBefore: 0,
              balanceAfter: 500000,
              userId: null,
              userUsername: null,
              adminId: 1,
              adminUsername: 'admin',
              reason: 'Initial',
              createdAt: '2026-05-19T00:00:00.000Z',
            },
          ],
          total: 1,
          limit: 25,
          offset: 0,
        });
      }
      return Promise.resolve({});
    });
    mockPost.mockResolvedValue({ balance: 850000 });
    mockPut.mockResolvedValue({ caps: { perRound: 2000000, perUserPerDay: 10000000, perDay: null } });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <HousePage />
      </MemoryRouter>
    );

  it('fetches house state and transactions on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/admin/house');
    });
    expect(mockGet).toHaveBeenCalledWith('/admin/house/transactions', expect.objectContaining({
      params: expect.objectContaining({ limit: 25, offset: 0 }),
    }));
  });

  it('renders the formatted balance', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('house-balance')).toHaveTextContent('750,000');
    });
  });

  it('submits a top-up via POST /admin/house/topup', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('house-balance'));

    const amountInput = screen.getByLabelText(/Amount/i);
    fireEvent.change(amountInput, { target: { value: '100000' } });

    const topUpBtn = screen.getByRole('button', { name: /^Top up$/i });
    fireEvent.click(topUpBtn);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/admin/house/topup', expect.objectContaining({ amount: 100000 }));
    });
  });

  it('renders the transaction row from the API', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Top-up/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Initial/)).toBeInTheDocument();
  });

  it('submits caps via PUT /admin/house/caps', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('house-balance'));

    const perRoundInput = screen.getByLabelText(/Per round/i);
    fireEvent.change(perRoundInput, { target: { value: '2000000' } });

    const saveBtn = screen.getByRole('button', { name: /Save caps/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/admin/house/caps', expect.objectContaining({ perRound: 2000000 }));
    });
  });

  describe('non-admin (viewer) access', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: { id: 5, username: 'viewer1', role: 'viewer' } });
    });

    it('hides Top-up, Set-balance, and Caps cards', async () => {
      renderPage();
      await waitFor(() => screen.getByTestId('house-balance'));

      expect(screen.queryByTestId('house-topup-card')).not.toBeInTheDocument();
      expect(screen.queryByTestId('house-caps-card')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Top up$/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Override balance/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Save caps/i })).not.toBeInTheDocument();
    });

    it('still shows balance and transactions (read-only)', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId('house-balance')).toHaveTextContent('750,000');
      });
      expect(screen.getByText(/Top-up/i)).toBeInTheDocument();
    });
  });

  describe('operator access', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: { id: 4, username: 'operator1', role: 'operator' } });
    });

    it('hides treasury write cards (operators cannot touch the treasury)', async () => {
      renderPage();
      await waitFor(() => screen.getByTestId('house-balance'));

      expect(screen.queryByTestId('house-topup-card')).not.toBeInTheDocument();
      expect(screen.queryByTestId('house-caps-card')).not.toBeInTheDocument();
    });
  });
});
