import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  default: { get: mockGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  api: { get: mockGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import AlertBell from '@/components/admin/AlertBell';

describe('AlertBell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const renderBell = () =>
    render(
      <MemoryRouter>
        <AlertBell />
      </MemoryRouter>
    );

  it('renders the bell button', async () => {
    mockGet.mockResolvedValue({ rows: [], total: 0, unreadCount: 0 });
    renderBell();
    await waitFor(() => {
      expect(screen.getByTestId('alert-bell')).toBeInTheDocument();
    });
    expect(mockGet).toHaveBeenCalledWith('/admin/alerts', expect.objectContaining({
      params: expect.objectContaining({ unreadOnly: 'true' }),
    }));
  });

  it('renders no badge when unreadCount is 0', async () => {
    mockGet.mockResolvedValue({ rows: [], total: 0, unreadCount: 0 });
    renderBell();
    await waitFor(() => {
      expect(screen.getByTestId('alert-bell')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('alert-bell-badge')).not.toBeInTheDocument();
  });

  it('renders a numeric badge when unreadCount > 0', async () => {
    mockGet.mockResolvedValue({ rows: [], total: 7, unreadCount: 7 });
    renderBell();
    await waitFor(() => {
      expect(screen.getByTestId('alert-bell-badge')).toHaveTextContent('7');
    });
  });

  it('caps the badge at 99+', async () => {
    mockGet.mockResolvedValue({ rows: [], total: 250, unreadCount: 250 });
    renderBell();
    await waitFor(() => {
      expect(screen.getByTestId('alert-bell-badge')).toHaveTextContent('99+');
    });
  });
});
