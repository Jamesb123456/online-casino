import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/games/crash/crashUtils', () => ({
  formatMultiplier: (m) => `${Number(m).toFixed(2)}`,
  getMultiplierColor: () => 'text-white',
}));

import CrashActiveBets from '@/games/crash/CrashActiveBets';

describe('CrashActiveBets', () => {
  it('renders empty state when there are no active bets', () => {
    render(<CrashActiveBets bets={[]} />);
    expect(screen.getByText(/No active bets/i)).toBeInTheDocument();
  });

  it('renders empty state when bets prop is undefined', () => {
    render(<CrashActiveBets />);
    expect(screen.getByText(/No active bets/i)).toBeInTheDocument();
  });

  it('renders a row for each active bet sorted by amount descending', () => {
    const bets = [
      { userId: 1, username: 'alice', amount: 50, autoCashoutAt: 2, cashedOut: false },
      { userId: 2, username: 'bob', amount: 200, autoCashoutAt: 1.5, cashedOut: false },
      { userId: 3, username: 'carol', amount: 25, cashedOut: true, cashedOutAt: 1.85 },
    ];
    render(<CrashActiveBets bets={bets} />);

    expect(screen.getByText(/Active Bets \(3\)/i)).toBeInTheDocument();

    const rows = screen.getAllByRole('row');
    // header + 3 bet rows
    expect(rows).toHaveLength(4);
    // Highest amount should appear first
    expect(rows[1]).toHaveTextContent(/bob/i);
    expect(rows[2]).toHaveTextContent(/alice/i);
    expect(rows[3]).toHaveTextContent(/carol/i);
  });

  it('shows cash-out multiplier for cashed-out bets and Active for in-progress bets', () => {
    const bets = [
      { userId: 1, username: 'alice', amount: 50, autoCashoutAt: 2, cashedOut: false },
      { userId: 2, username: 'bob', amount: 25, cashedOut: true, cashedOutAt: 1.85 },
    ];
    render(<CrashActiveBets bets={bets} />);

    expect(screen.getByText('Active')).toBeInTheDocument();
    // cashedOut value formatted by mocked formatMultiplier as "1.85"
    expect(screen.getByText(/1\.85x/)).toBeInTheDocument();
  });

  it('renders an avatar fallback initial when no avatar is supplied', () => {
    const bets = [{ userId: 1, username: 'zach', amount: 10, cashedOut: false }];
    render(<CrashActiveBets bets={bets} />);
    expect(screen.getByText('Z')).toBeInTheDocument();
  });
});
