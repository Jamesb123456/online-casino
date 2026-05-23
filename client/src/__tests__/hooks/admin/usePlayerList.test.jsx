import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';

const { mockGetPlayers } = vi.hoisted(() => ({
  mockGetPlayers: vi.fn(),
}));

vi.mock('@/services/admin/adminService', () => ({
  default: { getPlayers: mockGetPlayers },
}));

import usePlayerList from '@/hooks/admin/usePlayerList';

const samplePlayers = [
  { id: 1, username: 'alice', isActive: true, role: 'user', balance: 100 },
  { id: 2, username: 'bob', isActive: false, role: 'user', balance: 50 },
];

describe('usePlayerList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlayers.mockResolvedValue({ players: samplePlayers, totalCount: 2 });
  });

  it('has the documented initial state and fetches on mount', async () => {
    const { result } = renderHook(() => usePlayerList());

    // Initial defaults
    expect(result.current.sortField).toBe('username');
    expect(result.current.sortDirection).toBe('asc');
    expect(result.current.currentPage).toBe(1);
    expect(result.current.rowsPerPage).toBe(10);
    expect(result.current.activeFilter).toBe('all');
    expect(result.current.roleFilter).toBe('all');
    expect(result.current.searchTerm).toBe('');

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGetPlayers).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 10, sortBy: 'username', sortDir: 'asc' }),
    );
    expect(result.current.players).toHaveLength(2);
    expect(result.current.totalUsers).toBe(2);
    expect(result.current.totalPages).toBe(1);
  });

  it('refetches when search term changes and resets to page 1', async () => {
    const { result } = renderHook(() => usePlayerList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Jump to page 2 first so we can verify it resets to 1
    act(() => { result.current.setCurrentPage(2); });
    await waitFor(() => expect(result.current.currentPage).toBe(2));

    mockGetPlayers.mockClear();
    act(() => { result.current.handleSearchChange('alice'); });

    await waitFor(() => {
      expect(mockGetPlayers).toHaveBeenCalledWith(
        expect.objectContaining({ searchTerm: 'alice', page: 1 }),
      );
    });
    expect(result.current.currentPage).toBe(1);
    expect(result.current.searchTerm).toBe('alice');
  });

  it('refetches when active / role filters change', async () => {
    const { result } = renderHook(() => usePlayerList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    mockGetPlayers.mockClear();
    act(() => { result.current.handleFilterChange('active', 'active'); });
    await waitFor(() => {
      expect(mockGetPlayers).toHaveBeenCalledWith(
        expect.objectContaining({ activeOnly: true }),
      );
    });

    mockGetPlayers.mockClear();
    act(() => { result.current.handleFilterChange('role', 'admin'); });
    await waitFor(() => {
      expect(mockGetPlayers).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'admin' }),
      );
    });
  });

  it('toggles sort direction when the same column is selected again', async () => {
    const { result } = renderHook(() => usePlayerList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { result.current.handleSortChange('balance'); });
    await waitFor(() => expect(result.current.sortField).toBe('balance'));
    expect(result.current.sortDirection).toBe('asc');

    act(() => { result.current.handleSortChange('balance'); });
    await waitFor(() => expect(result.current.sortDirection).toBe('desc'));
  });

  it('handles rows-per-page changes and resets page', async () => {
    const { result } = renderHook(() => usePlayerList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { result.current.setCurrentPage(3); });
    await waitFor(() => expect(result.current.currentPage).toBe(3));

    act(() => { result.current.handleRowsPerPageChange('50'); });
    await waitFor(() => expect(result.current.rowsPerPage).toBe(50));
    expect(result.current.currentPage).toBe(1);
  });

  it('falls back to empty data on fetch error', async () => {
    mockGetPlayers.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => usePlayerList());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.players).toEqual([]);
    expect(result.current.totalUsers).toBe(0);
    expect(result.current.totalPages).toBe(1);
  });
});
