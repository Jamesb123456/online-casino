import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

// Capture events passed to useGameSocket and stub emit + status.
const emitMock = vi.fn();
let capturedEvents = {};

vi.mock('@/games/_shared/useGameSocket', () => {
  // Hook signature is (gameType, { events }).
  const impl = (_gameType, options = {}) => {
    const events = (options && options.events) || {};
    capturedEvents = events;
    return {
      socket: null,
      status: 'connected',
      lastError: null,
      serverSeedHash: 'abc123',
      emit: emitMock,
    };
  };
  return { __esModule: true, default: impl, useGameSocket: impl };
});

vi.mock('@/contexts/AudioContext', () => ({
  useAudio: () => ({
    play: vi.fn(),
    stop: vi.fn(),
    stopAmbient: vi.fn(),
    startAmbient: vi.fn(),
    SFX: { BET: 'bet', WIN: 'win', LOSS: 'loss', BIG_WIN: 'big_win' },
  }),
  AudioContext: React.createContext({}),
  AudioProvider: ({ children }) => children,
}));

vi.mock('@/hooks/useAuth', () => {
  const value = {
    user: { id: 1, username: 'testuser', balance: 1000 },
    isAuthenticated: true,
    updateBalance: vi.fn(),
  };
  return { useAuth: () => value, default: () => value };
});

// Canvas-confetti has no real backend under jsdom — neuter it so result banner
// reveals don't try to allocate a particle canvas.
vi.mock('canvas-confetti', () => {
  const fn = vi.fn();
  fn.reset = vi.fn();
  return { __esModule: true, default: fn };
});

vi.mock('@/games/blackjack/BlackjackHand', () => ({
  default: ({ hand = [], isDealer, hideHoleCard }) => (
    <div
      data-testid={isDealer ? 'dealer-hand' : 'player-hand'}
      data-hide-hole={hideHoleCard ? 'true' : 'false'}
    >
      {hand.length} cards
    </div>
  ),
}));

vi.mock('@/components/games/RulesButton', () => ({ default: () => null }));

import BlackjackGame from '@/games/blackjack/BlackjackGame';

const renderGame = () =>
  render(
    <MemoryRouter>
      <BlackjackGame />
    </MemoryRouter>,
  );

describe('BlackjackGame (shared shell)', () => {
  beforeEach(() => {
    emitMock.mockClear();
    capturedEvents = {};
  });

  it('renders without crashing', () => {
    renderGame();
    expect(screen.getByRole('heading', { name: /Blackjack/i })).toBeInTheDocument();
  });

  it('renders dealer and player hand slots', () => {
    renderGame();
    expect(screen.getByTestId('dealer-hand')).toBeInTheDocument();
    expect(screen.getByTestId('player-hand')).toBeInTheDocument();
  });

  it('shows the Deal CTA in betting phase', () => {
    renderGame();
    expect(screen.getByRole('button', { name: /^Deal$/i })).toBeInTheDocument();
  });

  it('deals cards: emits blackjack_start with the chosen amount', () => {
    renderGame();
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: /^Deal$/i }));
    expect(emitMock).toHaveBeenCalledWith('blackjack_start', { betAmount: 25 });
  });

  it('hit fetches another card: emits blackjack_hit', () => {
    renderGame();
    act(() => {
      capturedEvents.blackjack_game_state?.({
        gameId: 'bj_1',
        playerHand: [
          { rank: 'A', suit: 'hearts' },
          { rank: '7', suit: 'spades' },
        ],
        dealerHand: [{ rank: 'K', suit: 'clubs' }],
        playerScore: 18,
        betAmount: 10,
        status: 'active',
        canDouble: true,
      });
    });
    const hitBtn = screen.getByRole('button', { name: /Hit/i });
    fireEvent.click(hitBtn);
    expect(emitMock).toHaveBeenCalledWith('blackjack_hit', {});
  });

  it('stand triggers dealer play: emits blackjack_stand', () => {
    renderGame();
    act(() => {
      capturedEvents.blackjack_game_state?.({
        gameId: 'bj_2',
        playerHand: [
          { rank: '10', suit: 'hearts' },
          { rank: '8', suit: 'spades' },
        ],
        dealerHand: [{ rank: 'K', suit: 'clubs' }],
        playerScore: 18,
        betAmount: 10,
        status: 'active',
        canDouble: true,
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /Stand/i }));
    expect(emitMock).toHaveBeenCalledWith('blackjack_stand', {});
  });

  it('double emits blackjack_double when canDouble is true', () => {
    renderGame();
    act(() => {
      capturedEvents.blackjack_game_state?.({
        gameId: 'bj_3',
        playerHand: [
          { rank: '5', suit: 'hearts' },
          { rank: '6', suit: 'spades' },
        ],
        dealerHand: [{ rank: 'K', suit: 'clubs' }],
        playerScore: 11,
        betAmount: 10,
        status: 'active',
        canDouble: true,
      });
    });
    fireEvent.click(screen.getByRole('button', { name: /^Double \(D\)/i }));
    expect(emitMock).toHaveBeenCalledWith('blackjack_double', {});
  });

  it('disables Double when canDouble is false', () => {
    renderGame();
    act(() => {
      capturedEvents.blackjack_game_state?.({
        gameId: 'bj_4',
        playerHand: [
          { rank: '5', suit: 'hearts' },
          { rank: '6', suit: 'spades' },
          { rank: '3', suit: 'clubs' },
        ],
        dealerHand: [{ rank: 'K', suit: 'clubs' }],
        playerScore: 14,
        betAmount: 10,
        status: 'active',
        canDouble: false,
      });
    });
    expect(screen.getByRole('button', { name: /^Double \(D\)/i })).toBeDisabled();
  });

  it('keyboard H triggers hit, S triggers stand', () => {
    renderGame();
    act(() => {
      capturedEvents.blackjack_game_state?.({
        gameId: 'bj_5',
        playerHand: [
          { rank: '8', suit: 'hearts' },
          { rank: '9', suit: 'spades' },
        ],
        dealerHand: [{ rank: 'K', suit: 'clubs' }],
        playerScore: 17,
        betAmount: 10,
        status: 'active',
        canDouble: true,
      });
    });
    fireEvent.keyDown(window, { key: 'h' });
    expect(emitMock).toHaveBeenCalledWith('blackjack_hit', {});
    fireEvent.keyDown(window, { key: 's' });
    expect(emitMock).toHaveBeenCalledWith('blackjack_stand', {});
  });

  it('shows result banner on completed state', () => {
    renderGame();
    act(() => {
      capturedEvents.blackjack_game_state?.({
        gameId: 'bj_6',
        playerHand: [
          { rank: 'A', suit: 'hearts' },
          { rank: 'K', suit: 'spades' },
        ],
        dealerHand: [
          { rank: '10', suit: 'clubs' },
          { rank: '9', suit: 'clubs' },
        ],
        playerScore: 21,
        dealerScore: 19,
        betAmount: 10,
        status: 'completed',
        result: 'player_win',
        winAmount: 20,
      });
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/You Win/i);
    expect(alert).toHaveTextContent(/20/);
    expect(screen.getByRole('button', { name: /New Hand/i })).toBeInTheDocument();
  });

  it('surfaces blackjack_error message via aria-live', () => {
    renderGame();
    act(() => {
      capturedEvents.blackjack_error?.({ message: 'Insufficient balance' });
    });
    // The error text is collapsed into the BetControls status string.
    expect(
      screen.getByText((content) => /Insufficient balance/i.test(content)),
    ).toBeInTheDocument();
  });
});
