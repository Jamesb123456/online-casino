import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

// Hoisted mocks
const { emitSpy, lastEmits } = vi.hoisted(() => {
  const lastEmits = [];
  const emitSpy = vi.fn((event, payload, ack) => {
    lastEmits.push({ event, payload, ack });
  });
  return { emitSpy, lastEmits };
});

vi.mock('@/games/_shared/useGameSocket', () => {
  const hook = () => ({
    emit: emitSpy,
    status: 'connected',
    lastError: null,
    serverSeedHash: 'hash-current',
    socket: null,
  });
  return { __esModule: true, default: hook, useGameSocket: hook };
});

vi.mock('@/hooks/useAuth', () => {
  const hook = () => ({
    user: { id: 1, username: 'tester', balance: 1000 },
    updateBalance: vi.fn(),
  });
  return { __esModule: true, useAuth: hook, default: hook };
});

vi.mock('@/components/games/RulesButton', () => ({
  default: () => <button type="button" data-testid="rules-button">Rules</button>,
}));

// Canvas-confetti has no real backend under jsdom — neuter it so tile reveals
// don't try to allocate a particle canvas. Provide `reset` because the board
// calls it on unmount.
vi.mock('canvas-confetti', () => {
  const fn = vi.fn();
  fn.reset = vi.fn();
  return { __esModule: true, default: fn };
});

import LandminesGame from '@/games/landmines/LandminesGame';

const renderGame = () => render(<LandminesGame />);

const lastAckFor = (event) => {
  const entries = lastEmits.filter((e) => e.event === event);
  return entries[entries.length - 1]?.ack;
};

describe('LandminesGame (shared shell)', () => {
  beforeEach(() => {
    emitSpy.mockClear();
    lastEmits.length = 0;
  });

  it('renders title, controls, and a 5x5 grid', () => {
    renderGame();
    expect(screen.getByRole('heading', { name: /Landmines/i })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: /Landmines board/i })).toBeInTheDocument();
    expect(screen.getAllByRole('gridcell')).toHaveLength(25);
    expect(screen.getByRole('button', { name: /Start Game/i })).toBeInTheDocument();
  });

  it('shows the difficulty label for the mines selector', () => {
    renderGame();
    const descriptor = document.getElementById('lm-mines-difficulty');
    expect(descriptor).not.toBeNull();
    expect(descriptor.textContent).toMatch(/Easy/i);
  });

  it('emits landmines:start with the configured payload', () => {
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: /Start Game/i }));
    const startCall = lastEmits.find((e) => e.event === 'landmines:start');
    expect(startCall).toBeTruthy();
    expect(startCall.payload).toEqual({ betAmount: 10, mines: 3 });
    expect(typeof startCall.ack).toBe('function');
  });

  it('activates the round, picks a cell, and cashes out', () => {
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: /Start Game/i }));
    act(() => {
      lastAckFor('landmines:start')({
        success: true, gameId: 'g1', mines: 3, gridSize: 5, balance: 990,
      });
    });

    const cells = screen.getAllByRole('gridcell');
    fireEvent.click(cells[0]);
    const pickCall = lastEmits.find((e) => e.event === 'landmines:pick');
    expect(pickCall).toBeTruthy();
    expect(pickCall.payload).toEqual({ row: 0, col: 0 });

    act(() => {
      lastAckFor('landmines:pick')({
        success: true, hit: false, position: '0,0',
        multiplier: 1.34, potentialWin: 13.4, gameOver: false,
      });
    });

    const cashOutBtn = screen.getByRole('button', { name: /Cash Out/i });
    fireEvent.click(cashOutBtn);
    expect(lastEmits.find((e) => e.event === 'landmines:cashout')).toBeTruthy();

    act(() => {
      lastAckFor('landmines:cashout')({
        success: true, winAmount: 50, multiplier: 1.34, profit: 40, balance: 1040,
      });
    });
    expect(screen.getByText(/Cashed out/i)).toBeInTheDocument();
  });

  it('shows mine-hit result when pick ack reports a hit', () => {
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: /Start Game/i }));
    act(() => {
      lastAckFor('landmines:start')({
        success: true, gameId: 'g1', mines: 3, gridSize: 5, balance: 990,
      });
    });
    fireEvent.click(screen.getAllByRole('gridcell')[5]);
    act(() => {
      lastAckFor('landmines:pick')({
        success: true, hit: true, position: '1,0', gameOver: true,
        fullGrid: [
          [false, false, false, false, false],
          [true, false, false, false, false],
          [false, false, true, false, false],
          [false, false, false, false, false],
          [false, false, false, false, true],
        ],
        winAmount: 0,
      });
    });
    expect(screen.getByText(/Mine hit/i)).toBeInTheDocument();
    expect(screen.getByText(/MINE/)).toBeInTheDocument();
  });

  it('treats gameOver on a safe reveal as auto-cashout', () => {
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: /Start Game/i }));
    act(() => {
      lastAckFor('landmines:start')({
        success: true, gameId: 'g2', mines: 24, gridSize: 5, balance: 990,
      });
    });
    fireEvent.click(screen.getAllByRole('gridcell')[0]);
    act(() => {
      lastAckFor('landmines:pick')({
        success: true, hit: false, position: '0,0',
        multiplier: 20, potentialWin: 200, winAmount: 200, profit: 190, gameOver: true,
      });
    });
    expect(screen.getByText(/All safe tiles revealed/i)).toBeInTheDocument();
  });

  it('surfaces server start errors in the controls status', () => {
    renderGame();
    fireEvent.click(screen.getByRole('button', { name: /Start Game/i }));
    act(() => {
      lastAckFor('landmines:start')({ success: false, error: 'invalid_bet' });
    });
    expect(screen.getByText(/invalid_bet/i)).toBeInTheDocument();
  });

  it('handles arrow-key navigation across the grid without crashing', () => {
    renderGame();
    const cells = screen.getAllByRole('gridcell');
    cells[0].focus();
    fireEvent.keyDown(cells[0], { key: 'ArrowRight' });
    fireEvent.keyDown(cells[1], { key: 'ArrowDown' });
    fireEvent.keyDown(cells[6], { key: 'ArrowLeft' });
    fireEvent.keyDown(cells[5], { key: 'ArrowUp' });
    expect(cells).toHaveLength(25);
  });
});
