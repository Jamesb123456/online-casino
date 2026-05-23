import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('@/services/api', () => ({
  default: { get: mockGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  api: { get: mockGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import useTournamentsList from '@/hooks/admin/useTournamentsList';

const sampleRows = [
  { id: 1, name: 'T1', status: 'active' },
  { id: 2, name: 'T2', status: 'scheduled' },
];

describe('useTournamentsList', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockResolvedValue({ rows: sampleRows, total: 2 });
  });

  it('fetches with default params on mount', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useTournamentsList({ onError }));

    expect(result.current.statusFilter).toBe('');
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGet).toHaveBeenCalledWith('/admin/tournaments', { params: { limit: 100 } });
    expect(result.current.rows).toEqual(sampleRows);
    expect(result.current.total).toBe(2);
    expect(onError).not.toHaveBeenCalled();
  });

  it('refetches with status filter when set', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useTournamentsList({ onError }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockGet.mockClear();
    act(() => { result.current.setStatusFilter('active'); });
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(
        '/admin/tournaments',
        { params: { limit: 100, status: 'active' } },
      );
    });
  });

  it('reports errors via onError', async () => {
    mockGet.mockReset();
    mockGet.mockRejectedValueOnce(new Error('boom'));
    mockGet.mockResolvedValue({ rows: sampleRows, total: 2 });
    const onError = vi.fn();
    const { result } = renderHook(() => useTournamentsList({ onError }));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('boom'));
    expect(result.current.rows).toEqual([]);
  });

  it('exposes fetchList for manual refetch', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useTournamentsList({ onError }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockGet.mockClear();
    await act(async () => { await result.current.fetchList(); });
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('honors custom limit', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useTournamentsList({ onError, limit: 25 }));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGet).toHaveBeenCalledWith('/admin/tournaments', { params: { limit: 25 } });
  });
});
