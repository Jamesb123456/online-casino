import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const { mockGetPlayers, mockCreateTransaction } = vi.hoisted(() => ({
  mockGetPlayers: vi.fn(),
  mockCreateTransaction: vi.fn(),
}));

vi.mock('@/services/admin/adminService', () => ({
  default: { getPlayers: mockGetPlayers },
}));

vi.mock('@/services/admin/transactionService', () => ({
  default: { createTransaction: mockCreateTransaction },
}));

import CreateTransactionForm from '@/components/admin/CreateTransactionForm';

describe('CreateTransactionForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlayers.mockResolvedValue({
      players: [
        { id: 1, username: 'alice', email: 'a@x.com', role: 'user' },
        { id: 2, username: 'bob', email: 'b@x.com', role: 'user' },
      ],
    });
  });

  it('renders all form fields', async () => {
    render(<CreateTransactionForm />);
    await waitFor(() => expect(mockGetPlayers).toHaveBeenCalled());
    expect(screen.getByLabelText(/^User$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Transaction Type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Amount$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Reference\/Note/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create transaction/i })).toBeInTheDocument();
  });

  it('shows loaded users in the user dropdown', async () => {
    render(<CreateTransactionForm />);
    await waitFor(() => {
      expect(screen.getByText(/alice/)).toBeInTheDocument();
      expect(screen.getByText(/bob/)).toBeInTheDocument();
    });
  });

  it('submits a transaction and notifies the parent on success', async () => {
    const onCreated = vi.fn();
    mockCreateTransaction.mockResolvedValue({
      transaction: { id: 99, userId: 1, amount: 50 },
    });

    render(<CreateTransactionForm onTransactionCreated={onCreated} />);
    await waitFor(() => expect(mockGetPlayers).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/^User$/i), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText(/^Amount$/i), { target: { value: '50' } });

    fireEvent.click(screen.getByRole('button', { name: /create transaction/i }));

    await waitFor(() => {
      expect(mockCreateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ userId: '1', amount: 50, type: 'deposit' })
      );
    });

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith({ id: 99, userId: 1, amount: 50 });
    });
  });
});
