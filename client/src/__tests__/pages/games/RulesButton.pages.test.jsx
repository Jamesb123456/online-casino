import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

const { mockGet } = vi.hoisted(() => ({ mockGet: vi.fn() }));

vi.mock('@/services/api', () => ({
  default: { get: mockGet },
  api: { get: mockGet },
}));

vi.mock('@/layouts/MainLayout', () => ({
  default: ({ children }) => <div data-testid="main-layout">{children}</div>,
}));

// Stub all heavy game subtrees to keep this test fast and isolated.
vi.mock('@/games/crash/CrashGame', () => ({ default: () => <div>CrashGame</div> }));
vi.mock('@/games/plinko/PlinkoGame', () => ({ default: () => <div>PlinkoGame</div> }));
vi.mock('@/games/wheel/WheelGame', () => ({ default: () => <div>WheelGame</div> }));
vi.mock('@/games/roulette/RouletteGame', () => ({ default: () => <div>RouletteGame</div> }));
vi.mock('@/games/blackjack/BlackjackGame', () => ({ default: () => <div>BlackjackGame</div> }));
vi.mock('@/games/landmines/LandminesGame', () => ({ default: () => <div>LandminesGame</div> }));

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: React.createContext({ user: { balance: 1000 } }),
}));

import CrashPage from '@/pages/games/CrashPage';
import PlinkoPage from '@/pages/games/PlinkoPage';
import WheelPage from '@/pages/games/WheelPage';
import RoulettePage from '@/pages/games/RoulettePage';
import BlackjackPage from '@/pages/games/BlackjackPage';
import LandminesPage from '@/pages/games/LandminesPage';

const cases = [
  ['Crash', CrashPage, 'crash'],
  ['Plinko', PlinkoPage, 'plinko'],
  ['Wheel', WheelPage, 'wheel'],
  ['Roulette', RoulettePage, 'roulette'],
  ['Blackjack', BlackjackPage, 'blackjack'],
  ['Landmines', LandminesPage, 'landmines'],
];

// Skipped: this test stubs each `<GameName>Game` component out as a plain
// `<div>`, but the rules button lives inside `GameLayout` which is rendered
// by the game itself — so by design the button can never appear in the
// mocked output. The same behavior is already covered correctly by
// `__tests__/games/_shared/GameLayout.test.jsx`. Kept as a documented
// skip rather than deleted so the intent is visible for future repair.
describe.skip('Game pages — Rules button', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGet.mockResolvedValue({ houseEdge: 0.04, maxBet: 0, enabled: true });
  });

  it.each(cases)('%s page exposes a rules button that opens the modal', async (_name, Page, gameType) => {
    render(
      <MemoryRouter>
        <Page />
      </MemoryRouter>
    );

    const button = screen.getByTestId('rules-button');
    expect(button).toBeInTheDocument();

    fireEvent.click(button);

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith(`/games/config/${gameType}`);
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
