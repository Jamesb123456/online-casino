import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { mockGetProfile, mockGetSessions } = vi.hoisted(() => ({
  mockGetProfile: vi.fn(),
  mockGetSessions: vi.fn(),
}));

vi.mock('@/services/admin/analyticsService', () => ({
  default: {
    getPlayerProfile: mockGetProfile,
    getPlayerSessions: mockGetSessions,
  },
}));

import usePlayerProfile from '@/hooks/admin/usePlayerProfile';

const profileFixture = {
  username: 'alice',
  balance: 1000,
  isActive: true,
  overallStats: { totalWagered: 100 },
};

describe('usePlayerProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetProfile.mockResolvedValue(profileFixture);
    mockGetSessions.mockResolvedValue({ sessions: [], total: 0, totalPages: 1 });
  });

  it('fetches profile and sessions on mount', async () => {
    const { result } = renderHook(() => usePlayerProfile('77'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetProfile).toHaveBeenCalledWith('77');
    expect(mockGetSessions).toHaveBeenCalledWith(
      '77',
      expect.objectContaining({ page: 1, limit: 15, sortBy: 'startTime', sortOrder: 'desc' }),
    );
    expect(result.current.profile).toEqual(profileFixture);
    expect(result.current.error).toBeNull();
  });

  it('exposes error state when profile fetch fails', async () => {
    mockGetProfile.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => usePlayerProfile('1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.profile).toBeNull();
  });

  it('refetches sessions when game filter changes and resets page', async () => {
    const { result } = renderHook(() => usePlayerProfile('1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Move to page 2 first
    act(() => { result.current.setPage(2); });
    await waitFor(() => expect(result.current.page).toBe(2));

    mockGetSessions.mockClear();
    act(() => { result.current.handleGameFilterChange('crash'); });

    await waitFor(() => {
      expect(mockGetSessions).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ gameType: 'crash', page: 1 }),
      );
    });
    expect(result.current.page).toBe(1);
  });

  it('refetches when sort changes and resets page', async () => {
    const { result } = renderHook(() => usePlayerProfile('1'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.setPage(3); });
    await waitFor(() => expect(result.current.page).toBe(3));

    mockGetSessions.mockClear();
    act(() => { result.current.handleSortChange('totalBet', 'asc'); });

    await waitFor(() => {
      expect(mockGetSessions).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ sortBy: 'totalBet', sortOrder: 'asc', page: 1 }),
      );
    });
  });

  it('does not break on sessions fetch error', async () => {
    mockGetSessions.mockRejectedValueOnce(new Error('sess boom'));
    const { result } = renderHook(() => usePlayerProfile('1'));

    await waitFor(() => expect(result.current.sessionsLoading).toBe(false));
    // profile still loaded fine
    expect(result.current.profile).toEqual(profileFixture);
  });
});
