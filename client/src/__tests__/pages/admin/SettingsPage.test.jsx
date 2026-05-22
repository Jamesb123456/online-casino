import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const { mockGet, mockPut, mockUseAuth, mockToast } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
  mockUseAuth: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('@/hooks/useAuth', () => ({
  default: () => mockUseAuth(),
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/services/api', () => ({
  default: { get: mockGet, put: mockPut },
  api: { get: mockGet, put: mockPut },
}));

vi.mock('@/components/admin/AdminLayout', () => ({
  default: ({ children }) => <div data-testid="admin-layout">{children}</div>,
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => mockToast,
}));

import SettingsPage from '@/pages/admin/SettingsPage';

function setupGet({
  defaultBalance = { key: 'default_new_user_balance', value: 500 },
  caps = { caps: { perRound: 1000000, perUserPerDay: 10000000, perDay: null } },
  alerts = { bigWin: 50000, houseLow: 100000, rapidBetsPerMin: 30 },
  rewards = { min: 10, max: 100, streakBonus: 0, capPerDay: null },
  floor = { key: 'min_house_edge_floor', value: 0.01 },
} = {}) {
  mockGet.mockImplementation((url) => {
    if (url === '/admin/settings/default_new_user_balance') return Promise.resolve(defaultBalance);
    if (url === '/admin/house/caps') return Promise.resolve(caps);
    if (url === '/admin/alerts/settings') return Promise.resolve(alerts);
    if (url === '/admin/login-rewards/config') return Promise.resolve(rewards);
    if (url === '/admin/settings/min_house_edge_floor') return Promise.resolve(floor);
    return Promise.resolve({});
  });
}

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'admin', role: 'admin' } });
    setupGet();
    mockPut.mockResolvedValue({});
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

  it('renders all five cards', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId('settings-defaults-card')).toBeInTheDocument();
    });
    expect(screen.getByTestId('settings-caps-card')).toBeInTheDocument();
    expect(screen.getByTestId('settings-alerts-card')).toBeInTheDocument();
    expect(screen.getByTestId('settings-login-rewards-card')).toBeInTheDocument();
    expect(screen.getByTestId('settings-house-edge-floor-card')).toBeInTheDocument();
  });

  it('fetches data for every card on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/admin/settings/default_new_user_balance');
    });
    expect(mockGet).toHaveBeenCalledWith('/admin/house/caps');
    expect(mockGet).toHaveBeenCalledWith('/admin/alerts/settings');
    expect(mockGet).toHaveBeenCalledWith('/admin/login-rewards/config');
    expect(mockGet).toHaveBeenCalledWith('/admin/settings/min_house_edge_floor');
  });

  it('shows the fetched values in each card', async () => {
    renderPage();
    await waitFor(() => screen.getByLabelText(/Default new-user balance/i));

    expect(screen.getByLabelText(/Default new-user balance/i)).toHaveValue(500);
    expect(screen.getByLabelText(/Per round/i)).toHaveValue(1000000);
    expect(screen.getByLabelText(/Per user per day/i)).toHaveValue(10000000);
    expect(screen.getByLabelText(/Big win threshold/i)).toHaveValue(50000);
    expect(screen.getByLabelText(/House low threshold/i)).toHaveValue(100000);
    expect(screen.getByLabelText(/Rapid bets per minute/i)).toHaveValue(30);
    expect(screen.getByLabelText(/Minimum reward/i)).toHaveValue(10);
    expect(screen.getByLabelText(/Maximum reward/i)).toHaveValue(100);
    expect(screen.getByLabelText(/Min house edge \(fraction\)/i)).toHaveValue(0.01);
  });

  it('saves defaults card via PUT /admin/settings/default_new_user_balance', async () => {
    renderPage();
    await waitFor(() => screen.getByLabelText(/Default new-user balance/i));

    fireEvent.change(screen.getByLabelText(/Default new-user balance/i), { target: { value: '1000' } });
    fireEvent.click(screen.getByRole('button', { name: /Save defaults/i }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/admin/settings/default_new_user_balance', { value: 1000 });
    });
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('saves caps card via PUT /admin/house/caps', async () => {
    renderPage();
    await waitFor(() => screen.getByLabelText(/Per round/i));

    fireEvent.change(screen.getByLabelText(/Per round/i), { target: { value: '2000000' } });
    fireEvent.click(screen.getByRole('button', { name: /Save caps/i }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/admin/house/caps', expect.objectContaining({ perRound: 2000000 }));
    });
  });

  it('saves alerts card via PUT /admin/alerts/settings', async () => {
    renderPage();
    await waitFor(() => screen.getByLabelText(/Big win threshold/i));

    fireEvent.change(screen.getByLabelText(/Big win threshold/i), { target: { value: '75000' } });
    fireEvent.click(screen.getByRole('button', { name: /Save thresholds/i }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/admin/alerts/settings', expect.objectContaining({ bigWin: 75000 }));
    });
  });

  it('saves login rewards card via PUT /admin/login-rewards/config', async () => {
    renderPage();
    await waitFor(() => screen.getByLabelText(/Minimum reward/i));

    fireEvent.change(screen.getByLabelText(/Minimum reward/i), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText(/Maximum reward/i), { target: { value: '200' } });
    fireEvent.click(screen.getByRole('button', { name: /Save login rewards/i }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/admin/login-rewards/config', expect.objectContaining({
        min: 20,
        max: 200,
        capPerDay: null,
      }));
    });
  });

  it('saves house edge floor card via PUT /admin/settings/min_house_edge_floor', async () => {
    renderPage();
    await waitFor(() => screen.getByLabelText(/Min house edge \(fraction\)/i));

    fireEvent.change(screen.getByLabelText(/Min house edge \(fraction\)/i), { target: { value: '0.05' } });
    fireEvent.click(screen.getByRole('button', { name: /Save floor/i }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/admin/settings/min_house_edge_floor', { value: 0.05 });
    });
  });

  it('does not blank the page when one card fetch fails', async () => {
    mockGet.mockImplementation((url) => {
      if (url === '/admin/house/caps') return Promise.reject(new Error('boom'));
      if (url === '/admin/settings/default_new_user_balance') return Promise.resolve({ value: 500 });
      if (url === '/admin/alerts/settings') return Promise.resolve({ bigWin: 50000, houseLow: 100000, rapidBetsPerMin: 30 });
      if (url === '/admin/login-rewards/config') return Promise.resolve({ min: 10, max: 100, streakBonus: 0, capPerDay: null });
      if (url === '/admin/settings/min_house_edge_floor') return Promise.resolve({ value: 0.01 });
      return Promise.resolve({});
    });

    renderPage();
    // Other cards still rendered + working
    await waitFor(() => screen.getByLabelText(/Big win threshold/i));
    expect(screen.getByLabelText(/Default new-user balance/i)).toHaveValue(500);
    expect(mockToast.error).toHaveBeenCalled();
  });

  it('treats 404 on default_new_user_balance as a clean blank (no error toast)', async () => {
    mockGet.mockImplementation((url) => {
      if (url === '/admin/settings/default_new_user_balance') {
        return Promise.reject(new Error('HTTP 404: Not Found'));
      }
      if (url === '/admin/house/caps') return Promise.resolve({ caps: { perRound: 1, perUserPerDay: 1, perDay: null } });
      if (url === '/admin/alerts/settings') return Promise.resolve({ bigWin: 1, houseLow: 1, rapidBetsPerMin: 1 });
      if (url === '/admin/login-rewards/config') return Promise.resolve({ min: 1, max: 1, streakBonus: 0, capPerDay: null });
      if (url === '/admin/settings/min_house_edge_floor') return Promise.resolve({ value: 0.01 });
      return Promise.resolve({});
    });

    renderPage();
    await waitFor(() => screen.getByLabelText(/Default new-user balance/i));
    // Field is blank — number input with no value reads as null in JSDOM
    expect(screen.getByLabelText(/Default new-user balance/i)).toHaveValue(null);
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  describe('viewer (read-only) access', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: { id: 5, username: 'viewer1', role: 'viewer' } });
    });

    it('disables all inputs and save buttons', async () => {
      renderPage();
      await waitFor(() => screen.getByLabelText(/Default new-user balance/i));

      expect(screen.getByLabelText(/Default new-user balance/i)).toBeDisabled();
      expect(screen.getByLabelText(/Per round/i)).toBeDisabled();
      expect(screen.getByLabelText(/Big win threshold/i)).toBeDisabled();
      expect(screen.getByLabelText(/Minimum reward/i)).toBeDisabled();
      expect(screen.getByLabelText(/Min house edge \(fraction\)/i)).toBeDisabled();

      expect(screen.getByRole('button', { name: /Save defaults/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Save caps/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Save thresholds/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Save login rewards/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Save floor/i })).toBeDisabled();
    });
  });
});
