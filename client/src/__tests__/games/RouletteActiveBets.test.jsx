import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/lib/formatCredits', () => ({
  formatCredits: (n) => `$${Number(n).toFixed(2)}`,
}));

import RouletteActiveBets from '@/games/roulette/RouletteActiveBets';

describe('RouletteActiveBets', () => {
  it('renders empty state when there are no bets', () => {
    render(<RouletteActiveBets bets={[]} />);
    expect(screen.getByText(/No active bets/i)).toBeInTheDocument();
  });

  it('renders empty state when bets prop is undefined', () => {
    render(<RouletteActiveBets />);
    expect(screen.getByText(/No active bets/i)).toBeInTheDocument();
  });

  it('renders a row for every bet with correctly formatted bet types', () => {
    const bets = [
      { id: 1, username: 'alice', type: 'STRAIGHT', value: 17, amount: 10 },
      { id: 2, username: 'bob', type: 'RED', amount: 20 },
      { id: 3, username: 'carol', type: 'BLACK', amount: 30 },
      { id: 4, username: 'dave', type: 'ODD', amount: 40 },
      { id: 5, username: 'eve', type: 'EVEN', amount: 50 },
      { id: 6, username: 'frank', type: 'LOW', amount: 60 },
      { id: 7, username: 'grace', type: 'HIGH', amount: 70 },
      { id: 8, username: 'heidi', type: 'DOZEN', value: 2, amount: 80 },
      { id: 9, username: 'ivan', type: 'COLUMN', value: 3, amount: 90 },
      { id: 10, username: 'judy', type: 'CUSTOM', value: 'X', amount: 100 },
      { id: 11, username: 'kate', type: 'CUSTOM', amount: 110 },
    ];
    render(<RouletteActiveBets bets={bets} />);
    expect(screen.getByText('Number 17')).toBeInTheDocument();
    expect(screen.getByText('Red')).toBeInTheDocument();
    expect(screen.getByText('Black')).toBeInTheDocument();
    expect(screen.getByText('Odd')).toBeInTheDocument();
    expect(screen.getByText('Even')).toBeInTheDocument();
    expect(screen.getByText('1-18')).toBeInTheDocument();
    expect(screen.getByText('19-36')).toBeInTheDocument();
    expect(screen.getByText('Dozen 2')).toBeInTheDocument();
    expect(screen.getByText('Column 3')).toBeInTheDocument();
    expect(screen.getByText('CUSTOM X')).toBeInTheDocument();
    // Default branch with no value renders "CUSTOM " (trailing space)
    expect(screen.getByText((_, el) => el?.textContent === 'CUSTOM ')).toBeInTheDocument();
  });

  it('renders avatar image when bet includes an avatar', () => {
    const bets = [
      { id: 1, username: 'alice', avatar: 'https://example.com/a.png', type: 'RED', amount: 5 },
    ];
    render(<RouletteActiveBets bets={bets} />);
    const img = screen.getByAltText('alice');
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe('IMG');
  });
});
