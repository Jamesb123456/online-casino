import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Use vi.hoisted to create context before vi.mock runs
const { MockAuthContext } = vi.hoisted(() => {
  const { createContext } = require('react');
  return { MockAuthContext: createContext({}) };
});

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: MockAuthContext,
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn(), warning: vi.fn() }),
}));

vi.mock('@/layouts/MainLayout', () => ({
  default: ({ children }) => <div data-testid="main-layout">{children}</div>,
}));

import ProfilePage from '@/pages/ProfilePage';

const renderWithUser = (user) => {
  return render(
    <MockAuthContext.Provider value={{ user }}>
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    </MockAuthContext.Provider>
  );
};

describe('ProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should show not logged in message when no user', () => {
    renderWithUser(null);
    expect(screen.getByText(/not logged in/i)).toBeInTheDocument();
    expect(screen.getByText(/please log in/i)).toBeInTheDocument();
  });

  it('should render user profile when logged in', () => {
    renderWithUser({
      id: 1, username: 'testuser', role: 'user', balance: 5000, createdAt: '2024-01-01T00:00:00Z',
    });
    expect(screen.getByText('Your Profile')).toBeInTheDocument();
    expect(screen.getAllByText('testuser').length).toBeGreaterThanOrEqual(1);
  });

  it('should display user balance', () => {
    renderWithUser({
      id: 1, username: 'testuser', role: 'user', balance: 5000, createdAt: '2024-01-01T00:00:00Z',
    });
    expect(screen.getByText(/\$5,000/)).toBeInTheDocument();
  });

  it('should display member since date', () => {
    renderWithUser({
      id: 1, username: 'testuser', role: 'user', balance: 0, createdAt: '2024-06-15T00:00:00Z',
    });
    expect(screen.getByText(/member since/i)).toBeInTheDocument();
  });

  it('should show admin dashboard link for admin users', () => {
    renderWithUser({
      id: 1, username: 'adminuser', role: 'admin', balance: 10000, createdAt: '2024-01-01T00:00:00Z',
    });
    expect(screen.getByText(/admin dashboard/i)).toBeInTheDocument();
  });

  it('should not show admin dashboard link for regular users', () => {
    renderWithUser({
      id: 1, username: 'regularuser', role: 'user', balance: 1000, createdAt: '2024-01-01T00:00:00Z',
    });
    expect(screen.queryByText(/admin dashboard/i)).not.toBeInTheDocument();
  });

  it('should display first letter of username as avatar', () => {
    renderWithUser({
      id: 1, username: 'testuser', role: 'user', balance: 0, createdAt: '2024-01-01T00:00:00Z',
    });
    expect(screen.getByText('T')).toBeInTheDocument();
  });

  it('should show account type', () => {
    renderWithUser({
      id: 1, username: 'testuser', role: 'user', balance: 0, createdAt: '2024-01-01T00:00:00Z',
    });
    expect(screen.getByText(/account type/i)).toBeInTheDocument();
  });

  it('should have edit profile button', () => {
    renderWithUser({
      id: 1, username: 'testuser', role: 'user', balance: 0, createdAt: '2024-01-01T00:00:00Z',
    });
    expect(screen.getByText(/edit profile/i)).toBeInTheDocument();
  });

  it('should show game history section', () => {
    renderWithUser({
      id: 1, username: 'testuser', role: 'user', balance: 0, createdAt: '2024-01-01T00:00:00Z',
    });
    expect(screen.getByText(/recent game activity/i)).toBeInTheDocument();
  });

  it('should handle missing createdAt gracefully', () => {
    renderWithUser({
      id: 1, username: 'testuser', role: 'user', balance: 0,
    });
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });

  it('should show note about balance for regular users', () => {
    renderWithUser({
      id: 1, username: 'testuser', role: 'user', balance: 0, createdAt: '2024-01-01T00:00:00Z',
    });
    expect(screen.getByText(/balance can only be modified by administrators/i)).toBeInTheDocument();
  });
});
