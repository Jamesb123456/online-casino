import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('@/services/api', () => ({
  default: { get: mockGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  api: { get: mockGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

import AdminNav from '@/components/admin/AdminNav';

describe('AdminNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ rows: [], total: 0, unreadCount: 0 });
  });

  it('renders the admin navigation landmark', () => {
    render(
      <MemoryRouter>
        <AdminNav />
      </MemoryRouter>
    );
    expect(screen.getByRole('navigation', { name: /admin navigation/i })).toBeInTheDocument();
  });

  it('renders all primary admin nav items', () => {
    render(
      <MemoryRouter>
        <AdminNav />
      </MemoryRouter>
    );
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Players')).toBeInTheDocument();
    expect(screen.getByText('Game Analytics')).toBeInTheDocument();
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
  });

  it('renders a link back to the casino home', () => {
    render(
      <MemoryRouter>
        <AdminNav />
      </MemoryRouter>
    );
    const homeLink = screen.getByText('Return to Casino').closest('a');
    expect(homeLink).toHaveAttribute('href', '/');
  });
});
