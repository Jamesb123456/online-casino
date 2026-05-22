import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const { mockGet, mockPut, mockUseAuth } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPut: vi.fn(),
  mockUseAuth: vi.fn(),
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

vi.mock('@/contexts/ToastContext', () => {
  const toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
  return { useToast: () => toast };
});

import GamesConfigPage from '@/pages/admin/GamesConfigPage';

const sampleConfigs = [
  { gameType: 'crash', houseEdge: 0.04, payoutTable: {}, maxBet: 0, enabled: true },
  { gameType: 'roulette', houseEdge: 0.027, payoutTable: { RED: 1, STRAIGHT: 35 }, maxBet: 5000, enabled: true },
  { gameType: 'wheel', houseEdge: 0, payoutTable: { easy: [0, 0.5, 1], medium: [0, 0, 2], hard: [0, 0, 0, 5] }, maxBet: 0, enabled: true },
  { gameType: 'plinko', houseEdge: 0, payoutTable: { low: { 8: [2, 1, 1, 1, 0.5, 1, 1, 1, 2] }, medium: { 8: [3, 1, 1, 0.5, 0.3, 0.5, 1, 1, 3] }, high: { 8: [5, 2, 1, 0.5, 0.2, 0.5, 1, 2, 5] } }, maxBet: 0, enabled: true },
  { gameType: 'landmines', houseEdge: 0.05, payoutTable: {}, maxBet: 0, enabled: true },
  { gameType: 'blackjack', houseEdge: 0.02, payoutTable: { win: 2, blackjack: 2.5, push: 1 }, maxBet: 0, enabled: false },
];

describe('GamesConfigPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { id: 1, username: 'admin', role: 'admin' } });
    mockGet.mockResolvedValue({ configs: sampleConfigs });
    mockPut.mockResolvedValue({
      gameType: 'crash',
      houseEdge: 0.05,
      payoutTable: {},
      maxBet: 0,
      enabled: true,
    });
  });

  const renderPage = () =>
    render(
      <MemoryRouter>
        <GamesConfigPage />
      </MemoryRouter>
    );

  it('fetches all game configs on mount', async () => {
    renderPage();
    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/admin/games/configs');
    });
  });

  it('renders a card for each known game', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('game-config-grid'));
    expect(screen.getByText('Crash')).toBeInTheDocument();
    expect(screen.getByText('Roulette')).toBeInTheDocument();
    expect(screen.getByText('Wheel')).toBeInTheDocument();
    expect(screen.getByText('Plinko')).toBeInTheDocument();
    expect(screen.getByText('Landmines')).toBeInTheDocument();
    expect(screen.getByText('Blackjack')).toBeInTheDocument();
  });

  it('shows the current house edge for each game', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('game-config-grid'));
    expect(screen.getByTestId('edge-value-crash')).toHaveTextContent('4.00%');
    expect(screen.getByTestId('edge-value-roulette')).toHaveTextContent('2.70%');
  });

  it('toggles enabled state via PUT /admin/games/:gameType/config', async () => {
    renderPage();
    await waitFor(() => screen.getByTestId('game-config-grid'));

    const toggle = screen.getByTestId('enabled-toggle-blackjack');
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockPut).toHaveBeenCalledWith(
        '/admin/games/blackjack/config',
        expect.objectContaining({ enabled: true })
      );
    });
  });

  describe('non-admin (viewer) access', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: { id: 5, username: 'viewer1', role: 'viewer' } });
    });

    it('shows a read-only banner', async () => {
      renderPage();
      await waitFor(() => screen.getByTestId('game-config-grid'));
      expect(screen.getByTestId('config-readonly-banner')).toBeInTheDocument();
    });

    it('disables the enabled toggle for each game', async () => {
      renderPage();
      await waitFor(() => screen.getByTestId('game-config-grid'));
      expect(screen.getByTestId('enabled-toggle-crash')).toBeDisabled();
      expect(screen.getByTestId('enabled-toggle-blackjack')).toBeDisabled();
    });

    it('disables the Save max bet buttons', async () => {
      renderPage();
      await waitFor(() => screen.getByTestId('game-config-grid'));
      const saveButtons = screen.getAllByRole('button', { name: /Save max bet/i });
      expect(saveButtons.length).toBeGreaterThan(0);
      for (const btn of saveButtons) {
        expect(btn).toBeDisabled();
      }
    });

    it('does not call PUT when a disabled toggle is clicked', async () => {
      renderPage();
      await waitFor(() => screen.getByTestId('game-config-grid'));
      const toggle = screen.getByTestId('enabled-toggle-crash');
      fireEvent.click(toggle);
      // Brief wait to allow any unintended async writes to fire
      await new Promise((r) => setTimeout(r, 10));
      expect(mockPut).not.toHaveBeenCalled();
    });
  });

  describe('advanced payout editor modal', () => {
    it('renders the Roulette editor when Advanced is opened for roulette', async () => {
      renderPage();
      await waitFor(() => screen.getByTestId('game-config-grid'));
      fireEvent.click(screen.getByTestId('advanced-roulette'));
      await waitFor(() => expect(screen.getByTestId('roulette-payout-editor')).toBeInTheDocument());
      expect(screen.getByTestId('row-RED')).toBeInTheDocument();
      expect(screen.getByTestId('row-STRAIGHT')).toBeInTheDocument();
    });

    it('renders the Wheel editor when Advanced is opened for wheel', async () => {
      renderPage();
      await waitFor(() => screen.getByTestId('game-config-grid'));
      fireEvent.click(screen.getByTestId('advanced-wheel'));
      await waitFor(() => expect(screen.getByTestId('wheel-payout-editor')).toBeInTheDocument());
    });

    it('renders the Plinko editor when Advanced is opened for plinko', async () => {
      renderPage();
      await waitFor(() => screen.getByTestId('game-config-grid'));
      fireEvent.click(screen.getByTestId('advanced-plinko'));
      await waitFor(() => expect(screen.getByTestId('plinko-payout-editor')).toBeInTheDocument());
    });

    it('renders the Blackjack editor when Advanced is opened for blackjack', async () => {
      renderPage();
      await waitFor(() => screen.getByTestId('game-config-grid'));
      fireEvent.click(screen.getByTestId('advanced-blackjack'));
      await waitFor(() => expect(screen.getByTestId('blackjack-payout-editor')).toBeInTheDocument());
    });

    it('shows the formula-only message for crash', async () => {
      renderPage();
      await waitFor(() => screen.getByTestId('game-config-grid'));
      fireEvent.click(screen.getByTestId('advanced-crash'));
      await waitFor(() => expect(screen.getByTestId('formula-only-crash')).toBeInTheDocument());
    });

    it('PUTs the updated payoutTable when Save Payout Table is clicked', async () => {
      mockPut.mockResolvedValueOnce({
        gameType: 'roulette',
        houseEdge: 0.027,
        payoutTable: { RED: 0.8, STRAIGHT: 35 },
        maxBet: 5000,
        enabled: true,
      });
      renderPage();
      await waitFor(() => screen.getByTestId('game-config-grid'));
      fireEvent.click(screen.getByTestId('advanced-roulette'));
      await waitFor(() => screen.getByTestId('roulette-payout-editor'));
      // Lowering RED multiplier keeps RTP below 100% (safe for the floor check)
      fireEvent.change(screen.getByTestId('input-RED'), { target: { value: '0.8' } });
      const saveBtn = screen.getByTestId('save-payout-roulette');
      expect(saveBtn).not.toBeDisabled();
      fireEvent.click(saveBtn);
      await waitFor(() => {
        const rouletteCall = mockPut.mock.calls.find(
          (c) => c[0] === '/admin/games/roulette/config'
        );
        expect(rouletteCall).toBeTruthy();
        expect(rouletteCall[1]).toEqual(
          expect.objectContaining({
            payoutTable: expect.objectContaining({ RED: 0.8 }),
          })
        );
      });
    });
  });

  describe('operator access', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({ user: { id: 4, username: 'operator1', role: 'operator' } });
    });

    it('shows the read-only banner (game config is admin-only)', async () => {
      renderPage();
      await waitFor(() => screen.getByTestId('game-config-grid'));
      expect(screen.getByTestId('config-readonly-banner')).toBeInTheDocument();
    });
  });
});
