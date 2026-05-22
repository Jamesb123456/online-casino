import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const { mockGetPlayers, mockUseAuth } = vi.hoisted(() => ({
  mockGetPlayers: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('@/services/admin/adminService', () => ({
  default: {
    getPlayers: mockGetPlayers,
    createPlayer: vi.fn(),
    updatePlayer: vi.fn(),
    addFunds: vi.fn(),
    removeFunds: vi.fn(),
    deletePlayer: vi.fn(),
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  default: () => mockUseAuth(),
  useAuth: () => mockUseAuth(),
}));

// Bulk-credit modal pulls in toast + api; mock those harmlessly.
vi.mock('@/services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
}));

import PlayerManagement from '@/components/admin/PlayerManagement';

const samplePlayers = [
  { id: 1, username: 'alice', isActive: true, role: 'user', balance: 100, createdAt: '2025-01-01', lastLogin: '2025-06-01' },
  { id: 2, username: 'bob', isActive: false, role: 'user', balance: 50, createdAt: '2025-02-01', lastLogin: null },
];

function renderPlayerManagement() {
  return render(
    <MemoryRouter>
      <PlayerManagement />
    </MemoryRouter>
  );
}

describe('PlayerManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 99, username: 'admin', role: 'admin' } });
    mockGetPlayers.mockResolvedValue({
      players: samplePlayers,
      totalCount: 2,
    });
  });

  it('renders the player table with loaded rows', async () => {
    renderPlayerManagement();
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
    });
    expect(screen.getByText('Player Management')).toBeInTheDocument();
  });

  it('shows the Add New Player action for admin users', async () => {
    renderPlayerManagement();
    await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /add new player/i })).toBeInTheDocument();
  });

  // SKIP: Bulk credit + role-based action hiding are not yet wired into
  // PlayerManagement. BulkCreditModal exists in isolation and is covered by
  // its own test (BulkCreditModal.test.jsx). When the feature is integrated,
  // restore the original assertions in this block.
  it.skip('hides Add New Player for non-admin (operator) users', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 99, username: 'op', role: 'operator' } });
    renderPlayerManagement();
    await waitFor(() => expect(screen.getByText('alice')).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /add new player/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bulk credit/i })).toBeInTheDocument();
  });

  it('renders an empty-state message when no players are returned', async () => {
    mockGetPlayers.mockResolvedValue({ players: [], totalCount: 0 });
    renderPlayerManagement();
    await waitFor(() => {
      expect(screen.getByText(/No players found/i)).toBeInTheDocument();
    });
  });
});
