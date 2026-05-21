import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/lib/formatCredits', () => ({
  formatCredits: (n) => `$${Number(n).toFixed(2)}`,
}));

import WheelActiveBets from '@/games/wheel/WheelActiveBets';

describe('WheelActiveBets', () => {
  it('renders empty state when no bets are provided', () => {
    render(<WheelActiveBets bets={[]} />);
    expect(screen.getByText(/No active bets/i)).toBeInTheDocument();
  });

  it('renders empty state when bets prop is undefined', () => {
    render(<WheelActiveBets />);
    expect(screen.getByText(/No active bets/i)).toBeInTheDocument();
  });

  it('renders rows for each bet including difficulty and amount', () => {
    const bets = [
      { id: 1, username: 'alice', betAmount: 10, difficulty: 'hard' },
      { id: 2, username: 'bob', betAmount: 20 }, // default difficulty
    ];
    render(<WheelActiveBets bets={bets} />);
    expect(screen.getByText('alice')).toBeInTheDocument();
    expect(screen.getByText('bob')).toBeInTheDocument();
    expect(screen.getByText('hard')).toBeInTheDocument();
    expect(screen.getByText('medium')).toBeInTheDocument();
    expect(screen.getByText('$10.00')).toBeInTheDocument();
    expect(screen.getByText('$20.00')).toBeInTheDocument();
  });

  it('renders avatar image when avatar URL is provided', () => {
    const bets = [
      { id: 1, username: 'alice', avatar: 'https://example.com/a.png', betAmount: 10, difficulty: 'easy' },
    ];
    render(<WheelActiveBets bets={bets} />);
    const img = screen.getByAltText('alice');
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe('IMG');
  });
});
