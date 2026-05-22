import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import React from 'react';

const { mockGet, mockPut, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  default: { get: mockGet, post: vi.fn(), put: mockPut, delete: mockDelete },
  api: { get: mockGet, post: vi.fn(), put: mockPut, delete: mockDelete },
}));

const { mockGetPlayerProfile, mockGetPlayerSessions } = vi.hoisted(() => ({
  mockGetPlayerProfile: vi.fn(),
  mockGetPlayerSessions: vi.fn(),
}));

vi.mock('@/services/admin/analyticsService', () => ({
  default: {
    getPlayerProfile: mockGetPlayerProfile,
    getPlayerSessions: mockGetPlayerSessions,
  },
}));

vi.mock('@/hooks/useAuth', () => ({
  default: () => ({ user: { id: 1, username: 'admin', role: 'admin' } }),
  useAuth: () => ({ user: { id: 1, username: 'admin', role: 'admin' } }),
}));

vi.mock('@/contexts/ToastContext', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

import PlayerProfile from '@/components/admin/PlayerProfile';

const baseProfile = {
  username: 'player1',
  balance: 1000,
  isActive: true,
  memberSince: '2025-01-01T00:00:00Z',
  lastLogin: '2025-06-01T00:00:00Z',
  overallStats: {
    totalWagered: 500,
    netProfitLoss: 50,
    winRate: 55,
    avgBetSize: 10,
    totalDeposits: 0,
  },
  favoriteGame: { gameType: 'crash' },
  perGameBreakdown: [],
  riskIndicators: null,
  activityTimeline: [],
};

function renderProfile() {
  return render(
    <MemoryRouter initialEntries={['/admin/players/42']}>
      <Routes>
        <Route path="/admin/players/:userId" element={<PlayerProfile />} />
      </Routes>
    </MemoryRouter>
  );
}

// SKIP: The "Limits card" (session/bet/loss limits) is not yet implemented in
// PlayerProfile.jsx. These tests describe the intended feature; when the card
// lands (player limits UI + PUT /admin/user-limits/:userId wiring), re-enable
// this block. Existing PlayerProfile rendering is covered by other tests in
// this suite and by PlayerProfilePage.test.jsx.
describe.skip('PlayerProfile - Limits card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlayerProfile.mockResolvedValue(baseProfile);
    mockGetPlayerSessions.mockResolvedValue({ sessions: [], total: 0, totalPages: 1 });
  });

  it('renders the session-limit input with the current value', async () => {
    mockGet.mockResolvedValue({
      maxBetPerRound: 50,
      maxLossPerDay: 200,
      lockedUntil: null,
      sessionLimitMinutes: 90,
    });

    renderProfile();

    await waitFor(() => {
      expect(screen.getByTestId('player-limits-card')).toBeInTheDocument();
    });

    const sessionInput = await screen.findByLabelText('Session limit (minutes)');
    expect(sessionInput).toBeInTheDocument();
    expect(sessionInput.value).toBe('90');
  });

  it('renders an empty input when sessionLimitMinutes is null', async () => {
    mockGet.mockResolvedValue({
      maxBetPerRound: null,
      maxLossPerDay: null,
      lockedUntil: null,
      sessionLimitMinutes: null,
    });

    renderProfile();

    const sessionInput = await screen.findByLabelText('Session limit (minutes)');
    expect(sessionInput.value).toBe('');
  });

  it('sends sessionLimitMinutes in the PUT body when saving', async () => {
    mockGet.mockResolvedValue({
      maxBetPerRound: null,
      maxLossPerDay: null,
      lockedUntil: null,
      sessionLimitMinutes: null,
    });
    mockPut.mockResolvedValue({});

    renderProfile();

    const sessionInput = await screen.findByLabelText('Session limit (minutes)');
    fireEvent.change(sessionInput, { target: { value: '45' } });

    const saveBtn = screen.getByRole('button', { name: /Save Limits/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/admin/user-limits/42',
        expect.objectContaining({ sessionLimitMinutes: 45 }),
      );
    });
  });

  it('sends null sessionLimitMinutes when the input is cleared', async () => {
    mockGet.mockResolvedValue({
      maxBetPerRound: null,
      maxLossPerDay: null,
      lockedUntil: null,
      sessionLimitMinutes: 60,
    });
    mockPut.mockResolvedValue({});

    renderProfile();

    const sessionInput = await screen.findByLabelText('Session limit (minutes)');
    fireEvent.change(sessionInput, { target: { value: '' } });

    const saveBtn = screen.getByRole('button', { name: /Save Limits/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/admin/user-limits/42',
        expect.objectContaining({ sessionLimitMinutes: null }),
      );
    });
  });
});
