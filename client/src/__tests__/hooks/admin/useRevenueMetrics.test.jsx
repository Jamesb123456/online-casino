import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { mockGetRevenue } = vi.hoisted(() => ({ mockGetRevenue: vi.fn() }));

vi.mock('@/services/admin/analyticsService', () => ({
  default: { getRevenue: mockGetRevenue },
}));

import useRevenueMetrics from '@/hooks/admin/useRevenueMetrics';

const sampleData = {
  summary: { totalRevenue: 1 },
  timeSeries: [{ date: '2025-01-01', revenue: 1 }],
  revenueByGame: [],
};

describe('useRevenueMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRevenue.mockResolvedValue(sampleData);
  });

  it('uses 30d / day as initial state and fetches once', async () => {
    const { result } = renderHook(() => useRevenueMetrics());

    expect(result.current.period).toBe('30d');
    expect(result.current.granularity).toBe('day');

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetRevenue).toHaveBeenCalledWith({ period: '30d', granularity: 'day' });
    expect(result.current.data).toEqual(sampleData);
    expect(result.current.error).toBeNull();
  });

  it('refetches when period changes', async () => {
    const { result } = renderHook(() => useRevenueMetrics());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockGetRevenue.mockClear();
    act(() => { result.current.setPeriod('7d'); });
    await waitFor(() => {
      expect(mockGetRevenue).toHaveBeenCalledWith({ period: '7d', granularity: 'day' });
    });
  });

  it('refetches when granularity changes', async () => {
    const { result } = renderHook(() => useRevenueMetrics());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockGetRevenue.mockClear();
    act(() => { result.current.setGranularity('hour'); });
    await waitFor(() => {
      expect(mockGetRevenue).toHaveBeenCalledWith({ period: '30d', granularity: 'hour' });
    });
  });

  it('sets error message on fetch failure', async () => {
    mockGetRevenue.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useRevenueMetrics());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toMatch(/Failed to load revenue data/);
    expect(result.current.data).toBeNull();
  });

  it('respects custom initial period / granularity', async () => {
    const { result } = renderHook(() =>
      useRevenueMetrics({ initialPeriod: '7d', initialGranularity: 'hour' }),
    );
    expect(result.current.period).toBe('7d');
    expect(result.current.granularity).toBe('hour');
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGetRevenue).toHaveBeenCalledWith({ period: '7d', granularity: 'hour' });
  });
});
