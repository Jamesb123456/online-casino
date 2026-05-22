import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Mock the PixiStage so we never touch real WebGL in jsdom. The stub just
// renders the wrapper div with the expected aria-label so behavioural checks
// can find it.
vi.mock('@/games/_shared/PixiStage', () => ({
  default: ({ ariaLabel = 'Game canvas', className = '' }) => (
    <div role="img" aria-label={ariaLabel} className={className} data-testid="pixi-stage" />
  ),
}));

// Stub pixi.js + matter-js so importing them never blows up in jsdom.
vi.mock('pixi.js', () => ({
  Application: vi.fn(),
  Container: vi.fn(),
  Graphics: vi.fn(),
  Text: vi.fn(),
}));

vi.mock('matter-js', () => ({
  default: {
    Engine: { create: vi.fn(), update: vi.fn(), clear: vi.fn() },
    World: { add: vi.fn(), remove: vi.fn(), clear: vi.fn() },
    Bodies: { circle: vi.fn(), rectangle: vi.fn() },
    Body: { setVelocity: vi.fn() },
    Events: { on: vi.fn(), off: vi.fn() },
  },
}));

vi.mock('gsap', () => ({
  default: { fromTo: vi.fn(), to: vi.fn() },
}));

vi.mock('@/games/plinko/plinkoUtils', () => ({
  getPlinkoRows: () => 4,
  getNumberOfBuckets: (rows) => rows + 1,
  formatMultiplier: (m) => `${Number(m).toFixed(2)}x`,
  getMultiplierColor: () => 'rgb(124, 58, 237)',
  getPlinkoMultipliers: () => [0.5, 1, 2, 5, 0.5],
}));

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

import PlinkoBoard from '@/games/plinko/PlinkoBoard';

describe('PlinkoBoard', () => {
  it('renders an accessible canvas stage', () => {
    render(<PlinkoBoard multipliers={[1, 2, 3, 4, 5]} />);
    const stage = screen.getByRole('img', { name: /Plinko board/i });
    expect(stage).toBeInTheDocument();
  });

  it('renders without multipliers and without animation path', () => {
    render(<PlinkoBoard />);
    expect(screen.getByTestId('pixi-stage')).toBeInTheDocument();
  });

  it('accepts an animationPath prop without throwing', () => {
    const path = [0, 1, 0, 1];
    expect(() =>
      render(
        <PlinkoBoard
          multipliers={[1, 2, 3, 4, 5]}
          animationPath={path}
          onAnimationComplete={() => {}}
        />,
      ),
    ).not.toThrow();
  });

  it('cleans up on unmount', () => {
    const { unmount } = render(
      <PlinkoBoard multipliers={[1, 2, 3, 4, 5]} animationPath={[0, 1, 0, 1]} />,
    );
    expect(() => unmount()).not.toThrow();
  });
});
