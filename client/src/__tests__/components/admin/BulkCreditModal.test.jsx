import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import React from 'react';

const { mockPost, mockToast } = vi.hoisted(() => ({
  mockPost: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: mockPost, put: vi.fn(), delete: vi.fn() },
  api: { get: vi.fn(), post: mockPost, put: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => mockToast,
}));

import BulkCreditModal from '@/components/admin/BulkCreditModal';

describe('BulkCreditModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders amount, reason inputs, and three filter options', () => {
    render(<BulkCreditModal isOpen={true} onClose={() => {}} />);
    expect(screen.getByLabelText(/Amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Reason/i)).toBeInTheDocument();
    expect(screen.getByText(/All non-staff players/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Active within days/i)).toBeInTheDocument();
    expect(screen.getAllByLabelText(/User IDs/i).length).toBeGreaterThan(0);
  });

  it('calls dryRun on Preview and renders the count', async () => {
    mockPost.mockResolvedValueOnce({ wouldCredit: 12, sampleUsernames: ['a', 'b'] });

    render(<BulkCreditModal isOpen={true} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText(/Reason/i), { target: { value: 'Welcome bonus' } });

    fireEvent.click(screen.getByRole('button', { name: /^Preview$/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith(
        '/admin/users/bulk-credit',
        expect.objectContaining({
          amount: 50,
          reason: 'Welcome bonus',
          dryRun: true,
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('bulk-preview')).toHaveTextContent('Will credit 12 users');
    });
  });

  it('grants after a successful preview and fires success toast', async () => {
    // First call: dryRun preview
    mockPost.mockResolvedValueOnce({ wouldCredit: 3, sampleUsernames: ['alice', 'bob'] });
    // Second call: real grant
    mockPost.mockResolvedValueOnce({ credited: 3, failed: 0, errors: [], totalDebited: 300 });

    const onClose = vi.fn();
    const onGranted = vi.fn();

    render(<BulkCreditModal isOpen={true} onClose={onClose} onGranted={onGranted} />);

    fireEvent.change(screen.getByLabelText(/Amount/i), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText(/Reason/i), { target: { value: 'Apology' } });

    fireEvent.click(screen.getByRole('button', { name: /^Preview$/i }));
    await waitFor(() => expect(screen.getByTestId('bulk-preview')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /^Grant$/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenLastCalledWith(
        '/admin/users/bulk-credit',
        expect.objectContaining({ amount: 100, reason: 'Apology', dryRun: false })
      );
    });

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalled();
      expect(onGranted).toHaveBeenCalledWith(
        expect.objectContaining({ credited: 3, failed: 0, totalDebited: 300 })
      );
    });
  });

  it('Grant button is disabled until Preview has been run', () => {
    render(<BulkCreditModal isOpen={true} onClose={() => {}} />);
    const grantBtn = screen.getByRole('button', { name: /^Grant$/i });
    expect(grantBtn).toBeDisabled();
  });

  it('shows an error toast when the amount is missing on Preview', async () => {
    render(<BulkCreditModal isOpen={true} onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText(/Reason/i), { target: { value: 'Test' } });
    fireEvent.click(screen.getByRole('button', { name: /^Preview$/i }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });
    expect(mockPost).not.toHaveBeenCalled();
  });
});
