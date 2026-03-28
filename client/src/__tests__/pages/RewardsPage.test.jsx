import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  api: { get: mockGet, post: mockPost },
}));

vi.mock('@/layouts/MainLayout', () => ({
  default: ({ children }) => <div data-testid="main-layout">{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: React.createContext({
    isAuthenticated: true,
    user: { id: 1, username: 'testuser', balance: 1000 },
  }),
}));

import RewardsPage from '@/pages/RewardsPage';

describe('RewardsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockImplementation((url) => {
      if (url.includes('status')) {
        return Promise.resolve({ canClaim: true, nextRewardTime: null });
      }
      if (url.includes('history')) {
        return Promise.resolve({ rewards: [], totalRewards: 0 });
      }
      return Promise.resolve({});
    });
    mockPost.mockResolvedValue({ success: true, rewardAmount: 100, newBalance: 1100 });
  });

  const renderPage = () => {
    return render(
      <MemoryRouter>
        <RewardsPage />
      </MemoryRouter>
    );
  };

  it('should render in main layout', () => {
    renderPage();
    expect(screen.getByTestId('main-layout')).toBeInTheDocument();
  });

  it('should render rewards page content', async () => {
    renderPage();
    // The page should render without crashing
    await waitFor(() => {
      expect(screen.getByTestId('main-layout')).toBeInTheDocument();
    });
  });

  it('should fetch reward status on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/rewards/status');
    });
  });
});
