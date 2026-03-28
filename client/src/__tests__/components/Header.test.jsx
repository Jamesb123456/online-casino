import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '@/contexts/AuthContext';
import Header from '@/components/Header';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

/**
 * Helper to render Header with auth context and router
 */
function renderHeader(authValue = {}) {
  const defaultAuth = {
    user: null,
    loading: false,
    isAuthenticated: false,
    logout: vi.fn(),
    ...authValue,
  };

  return render(
    <AuthContext.Provider value={defaultAuth}>
      <MemoryRouter initialEntries={['/']}>
        <Header />
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

describe('Header', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Brand/Logo', () => {
    it('renders logo with Platinum Casino text', () => {
      renderHeader();

      expect(screen.getByText('Platinum')).toBeInTheDocument();
      expect(screen.getByText('Casino')).toBeInTheDocument();
    });

    it('logo links to home page', () => {
      renderHeader();

      // The logo is wrapped in a Link to="/"
      const link = screen.getByText('Platinum').closest('a');
      expect(link).toHaveAttribute('href', '/');
    });
  });

  describe('Navigation links', () => {
    it('renders Home link', () => {
      renderHeader();

      const homeLinks = screen.getAllByText('Home');
      expect(homeLinks.length).toBeGreaterThan(0);
    });

    it('renders Games link', () => {
      renderHeader();

      const gamesLinks = screen.getAllByText('Games');
      expect(gamesLinks.length).toBeGreaterThan(0);
    });

    it('renders Rewards link', () => {
      renderHeader();

      const rewardsLinks = screen.getAllByText('Rewards');
      expect(rewardsLinks.length).toBeGreaterThan(0);
    });

    it('renders Leaderboard link', () => {
      renderHeader();

      const leaderboardLinks = screen.getAllByText('Leaderboard');
      expect(leaderboardLinks.length).toBeGreaterThan(0);
    });
  });

  describe('Unauthenticated state', () => {
    it('shows Login link when not authenticated', () => {
      renderHeader({ isAuthenticated: false });

      const loginLinks = screen.getAllByText('Login');
      expect(loginLinks.length).toBeGreaterThan(0);
    });

    it('shows Sign Up link when not authenticated', () => {
      renderHeader({ isAuthenticated: false });

      const signUpLinks = screen.getAllByText('Sign Up');
      expect(signUpLinks.length).toBeGreaterThan(0);
    });

    it('does not show Logout button when not authenticated', () => {
      renderHeader({ isAuthenticated: false });

      expect(screen.queryByText('Logout')).not.toBeInTheDocument();
    });

    it('does not show balance when not authenticated', () => {
      renderHeader({ isAuthenticated: false });

      // Balance display should not be present
      expect(screen.queryByText('1,000')).not.toBeInTheDocument();
    });
  });

  describe('Authenticated state', () => {
    const authUser = {
      id: 1,
      username: 'testplayer',
      role: 'user',
      balance: 1500,
    };

    it('shows username when authenticated', () => {
      renderHeader({
        user: authUser,
        isAuthenticated: true,
      });

      expect(screen.getByText('testplayer')).toBeInTheDocument();
    });

    it('shows balance display when authenticated', () => {
      renderHeader({
        user: authUser,
        isAuthenticated: true,
      });

      // Balance should be displayed (formatted with toLocaleString)
      const balanceElements = screen.getAllByText('1,500');
      expect(balanceElements.length).toBeGreaterThan(0);
    });

    it('shows Logout button when authenticated', () => {
      renderHeader({
        user: authUser,
        isAuthenticated: true,
      });

      const logoutButtons = screen.getAllByText('Logout');
      expect(logoutButtons.length).toBeGreaterThan(0);
    });

    it('does not show Login/Sign Up when authenticated', () => {
      renderHeader({
        user: authUser,
        isAuthenticated: true,
      });

      expect(screen.queryByText('Login')).not.toBeInTheDocument();
      expect(screen.queryByText('Sign Up')).not.toBeInTheDocument();
    });

    it('calls logout and navigates to / on logout click', async () => {
      const user = userEvent.setup();
      const mockLogout = vi.fn();

      renderHeader({
        user: authUser,
        isAuthenticated: true,
        logout: mockLogout,
      });

      // Click the desktop Logout button (first one found)
      const logoutButtons = screen.getAllByText('Logout');
      await user.click(logoutButtons[0]);

      expect(mockLogout).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('Admin user', () => {
    const adminUser = {
      id: 1,
      username: 'adminuser',
      role: 'admin',
      balance: 5000,
    };

    it('shows Admin link when user is admin', () => {
      renderHeader({
        user: adminUser,
        isAuthenticated: true,
      });

      expect(screen.getByText('Admin')).toBeInTheDocument();
    });

    it('does not show Admin link for regular users', () => {
      renderHeader({
        user: { ...adminUser, role: 'user' },
        isAuthenticated: true,
      });

      expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    });
  });

  describe('Mobile menu', () => {
    it('renders hamburger menu button', () => {
      renderHeader();

      const menuButton = screen.getByRole('button', { name: /open menu/i });
      expect(menuButton).toBeInTheDocument();
    });

    it('toggles mobile menu on hamburger click', async () => {
      const user = userEvent.setup();
      renderHeader();

      const menuButton = screen.getByRole('button', { name: /open menu/i });
      await user.click(menuButton);

      // After opening, there should be a mobile nav
      const mobileNav = screen.getByRole('navigation', { name: /mobile/i });
      expect(mobileNav).toBeInTheDocument();

      // Button label should change to Close menu
      expect(screen.getByRole('button', { name: /close menu/i })).toBeInTheDocument();
    });
  });

  describe('Balance formatting', () => {
    it('shows "0" balance when user has no balance', () => {
      renderHeader({
        user: { id: 1, username: 'broke', role: 'user', balance: 0 },
        isAuthenticated: true,
      });

      const balanceElements = screen.getAllByText('0');
      expect(balanceElements.length).toBeGreaterThan(0);
    });
  });
});
