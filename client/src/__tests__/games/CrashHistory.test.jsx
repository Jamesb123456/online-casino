import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/games/crash/crashUtils', () => ({
  formatMultiplier: (m) => `${Number(m).toFixed(2)}x`,
  getMultiplierColor: () => '#ffffff',
}));

import CrashHistory from '@/games/crash/CrashHistory';

describe('CrashHistory', () => {
  it('renders the empty state when no history is provided', () => {
    render(<CrashHistory history={[]} />);
    expect(screen.getByText(/No recent games found/i)).toBeInTheDocument();
    // All three stats show defaults when empty
    const zeros = screen.getAllByText('0.00x');
    // Highest, Average, Lowest all default to 0.00x
    expect(zeros.length).toBeGreaterThanOrEqual(3);
  });

  it('uses default empty array when no history prop is provided', () => {
    render(<CrashHistory />);
    expect(screen.getByText(/No recent games found/i)).toBeInTheDocument();
  });

  it('renders a tile for each history entry with formatted time', () => {
    const history = [
      { id: 'a', crashPoint: 1.5, timestamp: Date.now() - 60_000 },
      { id: 'b', crashPoint: 4.2, timestamp: Date.now() - 30_000 },
      { id: 'c', crashPoint: 10.0, timestamp: Date.now() },
    ];
    render(<CrashHistory history={history} />);
    // The tile span renders the formatted multiplier; stat cards also do — so >= 1 each.
    expect(screen.getAllByText('1.50x').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('4.20x').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('10.00x').length).toBeGreaterThanOrEqual(1);
    // The lowest stat (1.50x) appears at least twice (tile + stat card)
    expect(screen.getAllByText('1.50x').length).toBeGreaterThanOrEqual(2);
  });

  it('computes highest/average/lowest stats from history data', () => {
    const history = [
      { id: 'a', crashPoint: 2.0, timestamp: 0 },
      { id: 'b', crashPoint: 4.0, timestamp: 0 },
      { id: 'c', crashPoint: 6.0, timestamp: 0 },
    ];
    render(<CrashHistory history={history} />);
    // Highest 6.00x (tile + stat), Average 4.00x (tile + stat), Lowest 2.00x (tile + stat)
    expect(screen.getAllByText('6.00x').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('4.00x').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('2.00x').length).toBeGreaterThanOrEqual(2);
  });
});
