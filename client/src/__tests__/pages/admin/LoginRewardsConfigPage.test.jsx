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

import LoginRewardsConfigPage from '@/pages/admin/LoginRewardsConfigPage';

const defaultConfig = { min: 10, max: 100, streakBonus: 0, capPerDay: null };

describe('LoginRewardsConfigPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'admin', role: 'admin' } });
    mockGet.mockResolvedValue(defaultConfig);
    mockPut.mockResolvedValue({ min: 25, max: 250, streakBonus: 5, capPerDay: 1000 });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <LoginRewardsConfigPage />
      </MemoryRouter>
    );

  it('fetches config on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/admin/login-rewards/config');
    });
  });

  it('renders inputs with current values', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/Minimum reward/i)).toHaveValue(10);
    });
    expect(screen.getByLabelText(/Maximum reward/i)).toHaveValue(100);
    expect(screen.getByLabelText(/Streak bonus/i)).toHaveValue(0);
    // capPerDay was null → blank
    expect(screen.getByLabelText(/Per-day cap/i)).toHaveValue(null);
  });

  it('PUTs the patched config on save', async () => {
    renderPage();
    await waitFor(() => screen.getByLabelText(/Minimum reward/i));

    fireEvent.change(screen.getByLabelText(/Minimum reward/i), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText(/Maximum reward/i), { target: { value: '250' } });
    fireEvent.change(screen.getByLabelText(/Streak bonus/i), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Per-day cap/i), { target: { value: '1000' } });

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith('/admin/login-rewards/config', {
        min: 25,
        max: 250,
        streakBonus: 5,
        capPerDay: 1000,
      });
    });
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('sends capPerDay: null when blank', async () => {
    renderPage();
    await waitFor(() => screen.getByLabelText(/Minimum reward/i));

    // Leave capPerDay blank (it's already null in fixture). Bump min to 5.
    fireEvent.change(screen.getByLabelText(/Minimum reward/i), { target: { value: '5' } });

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/admin/login-rewards/config',
        expect.objectContaining({ capPerDay: null })
      );
    });
  });

  it('shows toast and skips PUT on save failure', async () => {
    mockPut.mockRejectedValueOnce(new Error('server error'));
    renderPage();
    await waitFor(() => screen.getByLabelText(/Minimum reward/i));

    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });
  });

  it('rejects max < min client-side (no PUT)', async () => {
    renderPage();
    await waitFor(() => screen.getByLabelText(/Minimum reward/i));

    fireEvent.change(screen.getByLabelText(/Minimum reward/i), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText(/Maximum reward/i), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalled();
    });
    expect(mockPut).not.toHaveBeenCalled();
  });

  describe('non-admin (viewer) access', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: { id: 5, username: 'viewer1', role: 'viewer' } });
    });

    it('disables save button and all inputs for viewer', async () => {
      renderPage();
      await waitFor(() => screen.getByLabelText(/Minimum reward/i));

      expect(screen.getByLabelText(/Minimum reward/i)).toBeDisabled();
      expect(screen.getByLabelText(/Maximum reward/i)).toBeDisabled();
      expect(screen.getByLabelText(/Streak bonus/i)).toBeDisabled();
      expect(screen.getByLabelText(/Per-day cap/i)).toBeDisabled();
      expect(screen.getByRole('button', { name: /Save/i })).toBeDisabled();
    });

    it('still shows current config values (read-only)', async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByLabelText(/Minimum reward/i)).toHaveValue(10);
      });
    });
  });
});
