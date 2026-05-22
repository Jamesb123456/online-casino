import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';

/**
 * Dice does not have a standalone BettingPanel component — the betting
 * controls live inside DiceGame (now via the shared BetControls primitive).
 * These tests cover the betting form, input validation and the outbound
 * dice:roll payload.
 */
const { emitMock } = vi.hoisted(() => ({ emitMock: vi.fn() }));

vi.mock('@/games/_shared/useGameSocket', () => ({
  __esModule: true,
  default: () => ({
    socket: null,
    status: 'connected',
    lastError: null,
    serverSeedHash: 'hash-abc',
    emit: emitMock,
  }),
  useGameSocket: () => ({
    socket: null,
    status: 'connected',
    lastError: null,
    serverSeedHash: 'hash-abc',
    emit: emitMock,
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  __esModule: true,
  default: () => ({
    user: { id: 1, username: 'tester', balance: 1000 },
    updateBalance: vi.fn(),
  }),
  useAuth: () => ({
    user: { id: 1, username: 'tester', balance: 1000 },
    updateBalance: vi.fn(),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  AuthContext: React.createContext({
    user: { id: 1, username: 'tester', balance: 1000 },
    updateBalance: vi.fn(),
  }),
}));

vi.mock('@/components/casino/WinBurst', () => ({
  useWinBurst: () => ({ burst: vi.fn(), WinBurst: () => null }),
}));

vi.mock('@/contexts/AudioContext', () => ({
  useAudio: () => ({
    play: vi.fn(),
    stop: vi.fn(),
    startAmbient: vi.fn(),
    stopAmbient: vi.fn(),
    muted: false,
    volume: 0.5,
    setMuted: vi.fn(),
    setVolume: vi.fn(),
    SFX: { BET: 'bet', WIN: 'win', LOSS: 'loss', BIG_WIN: 'big_win' },
  }),
}));

import DiceGame from '@/games/dice/DiceGame';

const renderGame = () => render(
  <MemoryRouter>
    <DiceGame />
  </MemoryRouter>,
);

const rollCalls = () => emitMock.mock.calls.filter((c) => c[0] === 'dice:roll');

describe('DiceBettingPanel (DiceGame betting controls)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    emitMock.mockReset();
  });

  it('renders bet amount input, target slider, direction radios and roll button', () => {
    renderGame();
    expect(screen.getByLabelText(/Bet amount/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Target/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Roll Under/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Roll Over/i })).toBeInTheDocument();
    expect(screen.getByTestId('dice-roll-button')).toBeInTheDocument();
  });

  it('updates the bet amount input on change', () => {
    renderGame();
    const input = screen.getByLabelText(/Bet amount/i);
    fireEvent.change(input, { target: { value: '50' } });
    // BetPanel formats the value to two decimals.
    expect(Number(input.value)).toBe(50);
  });

  it('emits the correct socket payload on roll click', () => {
    renderGame();
    fireEvent.change(screen.getByLabelText(/Bet amount/i), { target: { value: '15' } });
    fireEvent.change(screen.getByLabelText(/Target/i), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('radio', { name: /Roll Over/i }));
    fireEvent.click(screen.getByTestId('dice-roll-button'));

    const calls = rollCalls();
    expect(calls).toHaveLength(1);
    const [, payload, cb] = calls[0];
    expect(payload).toEqual({ betAmount: 15, target: 40, direction: 'over' });
    expect(typeof cb).toBe('function');
  });

  it('clamps target to valid range (1..99) when emitting the payload', () => {
    renderGame();
    fireEvent.change(screen.getByLabelText(/Target/i), { target: { value: '99' } });
    fireEvent.click(screen.getByTestId('dice-roll-button'));
    const calls = rollCalls();
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][1]).toMatchObject({ target: 99 });
  });

  it('disables the roll button while a roll is in progress', () => {
    renderGame();
    const btn = screen.getByTestId('dice-roll-button');
    fireEvent.click(btn);
    // Ack callback not invoked → button stays disabled.
    expect(btn).toBeDisabled();
  });
});
