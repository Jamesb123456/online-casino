import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('@/services/api', () => ({
  default: { get: mockGet, put: vi.fn() },
  api: { get: mockGet, put: vi.fn() },
}));

import useSiteSettings from '@/hooks/admin/useSiteSettings';

function setupGet({
  defaults = { value: 500 },
  caps = { caps: { perRound: 1000, perUserPerDay: 5000, perDay: null } },
  alerts = { bigWin: 50000, houseLow: 100000, rapidBetsPerMin: 30 },
  rewards = { min: 10, max: 100, streakBonus: 5, capPerDay: null },
  floor = { value: 0.01 },
} = {}) {
  mockGet.mockImplementation((url) => {
    if (url === '/admin/settings/default_new_user_balance') return Promise.resolve(defaults);
    if (url === '/admin/house/caps') return Promise.resolve(caps);
    if (url === '/admin/alerts/settings') return Promise.resolve(alerts);
    if (url === '/admin/login-rewards/config') return Promise.resolve(rewards);
    if (url === '/admin/settings/min_house_edge_floor') return Promise.resolve(floor);
    return Promise.resolve({});
  });
}

describe('useSiteSettings', () => {
  beforeEach(() => {
    mockGet.mockReset();
    setupGet();
  });

  it('fetches all five domains on mount', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useSiteSettings({ onError }));

    await waitFor(() => expect(result.current.defaults.loading).toBe(false));
    await waitFor(() => expect(result.current.caps.loading).toBe(false));
    await waitFor(() => expect(result.current.alerts.loading).toBe(false));
    await waitFor(() => expect(result.current.rewards.loading).toBe(false));
    await waitFor(() => expect(result.current.floor.loading).toBe(false));

    expect(mockGet).toHaveBeenCalledWith('/admin/settings/default_new_user_balance');
    expect(mockGet).toHaveBeenCalledWith('/admin/house/caps');
    expect(mockGet).toHaveBeenCalledWith('/admin/alerts/settings');
    expect(mockGet).toHaveBeenCalledWith('/admin/login-rewards/config');
    expect(mockGet).toHaveBeenCalledWith('/admin/settings/min_house_edge_floor');

    expect(result.current.defaults.defaultNewUserBalance).toBe('500');
    expect(result.current.caps.capsForm).toEqual({
      perRound: '1000',
      perUserPerDay: '5000',
      perDay: '',
    });
    expect(result.current.alerts.alertsForm.bigWin).toBe('50000');
    expect(result.current.rewards.rewardsForm.min).toBe('10');
    expect(result.current.floor.houseEdgeFloor).toBe('0.01');

    expect(onError).not.toHaveBeenCalled();
  });

  it('silently swallows 404 on default_new_user_balance', async () => {
    mockGet.mockImplementation((url) => {
      if (url === '/admin/settings/default_new_user_balance') {
        return Promise.reject(new Error('HTTP 404: Not Found'));
      }
      if (url === '/admin/house/caps') return Promise.resolve({ caps: {} });
      if (url === '/admin/alerts/settings') return Promise.resolve({});
      if (url === '/admin/login-rewards/config') return Promise.resolve({});
      if (url === '/admin/settings/min_house_edge_floor') return Promise.resolve({ value: 0.01 });
      return Promise.resolve({});
    });
    const onError = vi.fn();
    const { result } = renderHook(() => useSiteSettings({ onError }));

    await waitFor(() => expect(result.current.defaults.loading).toBe(false));
    expect(result.current.defaults.defaultNewUserBalance).toBe('');
    expect(onError).not.toHaveBeenCalled();
  });

  it('reports non-404 fetch errors via onError', async () => {
    mockGet.mockImplementation((url) => {
      if (url === '/admin/house/caps') return Promise.reject(new Error('boom'));
      if (url === '/admin/settings/default_new_user_balance') return Promise.resolve({ value: 500 });
      if (url === '/admin/alerts/settings') return Promise.resolve({});
      if (url === '/admin/login-rewards/config') return Promise.resolve({});
      if (url === '/admin/settings/min_house_edge_floor') return Promise.resolve({ value: 0.01 });
      return Promise.resolve({});
    });
    const onError = vi.fn();
    const { result } = renderHook(() => useSiteSettings({ onError }));

    await waitFor(() => expect(result.current.caps.loading).toBe(false));
    expect(onError).toHaveBeenCalledWith(expect.stringContaining('boom'));
    // Other cards still populated
    expect(result.current.defaults.defaultNewUserBalance).toBe('500');
  });

  it('exposes setters and refetch callbacks', async () => {
    const onError = vi.fn();
    const { result } = renderHook(() => useSiteSettings({ onError }));
    await waitFor(() => expect(result.current.defaults.loading).toBe(false));

    expect(typeof result.current.refetchDefaults).toBe('function');
    expect(typeof result.current.refetchCaps).toBe('function');
    expect(typeof result.current.refetchAlerts).toBe('function');
    expect(typeof result.current.refetchRewards).toBe('function');
    expect(typeof result.current.refetchFloor).toBe('function');
    expect(typeof result.current.defaults.setDefaultNewUserBalance).toBe('function');
  });
});
