import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const { mockGet, mockUseAuth } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockUseAuth: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  default: { get: mockGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  api: { get: mockGet, post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('@/hooks/useAuth', () => ({
  default: () => mockUseAuth(),
  useAuth: () => mockUseAuth(),
}));

import AdminLayout from '@/components/admin/AdminLayout';

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ rows: [], total: 0, unreadCount: 0 });
  });

  it('shows a loading state while auth is loading', () => {
    mockUseAuth.mockReturnValue({ user: null, loading: true, logout: vi.fn() });
    render(
      <MemoryRouter>
        <AdminLayout>
          <div>child content</div>
        </AdminLayout>
      </MemoryRouter>
    );
    expect(screen.getByText(/loading admin panel/i)).toBeInTheDocument();
  });

  it('renders the admin layout with children for an admin user', () => {
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'admin', role: 'admin' },
      loading: false,
      logout: vi.fn(),
    });
    render(
      <MemoryRouter>
        <AdminLayout>
          <div data-testid="admin-child">child content</div>
        </AdminLayout>
      </MemoryRouter>
    );
    expect(screen.getByText('Casino Admin')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByTestId('admin-child')).toBeInTheDocument();
  });

  it('calls logout when the Logout button is clicked', async () => {
    const logout = vi.fn();
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'admin', role: 'admin' },
      loading: false,
      logout,
    });
    render(
      <MemoryRouter>
        <AdminLayout>
          <div>child</div>
        </AdminLayout>
      </MemoryRouter>
    );
    await user.click(screen.getByRole('button', { name: /logout/i }));
    expect(logout).toHaveBeenCalled();
  });

  it('toggles the sidebar collapsed state via the collapse button', async () => {
    const user = userEvent.setup();
    mockUseAuth.mockReturnValue({
      user: { id: 1, username: 'admin', role: 'admin' },
      loading: false,
      logout: vi.fn(),
    });
    render(
      <MemoryRouter>
        <AdminLayout>
          <div>child</div>
        </AdminLayout>
      </MemoryRouter>
    );
    const collapseBtn = screen.getByRole('button', { name: /collapse sidebar/i });
    await user.click(collapseBtn);
    expect(screen.getByRole('button', { name: /expand sidebar/i })).toBeInTheDocument();
  });
});
