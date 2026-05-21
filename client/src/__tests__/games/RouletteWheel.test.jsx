import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('@/games/roulette/rouletteUtils', () => ({
  ROULETTE_NUMBERS: [
    { number: 0, color: 'green' },
    { number: 1, color: 'red' },
    { number: 2, color: 'black' },
    { number: 17, color: 'red' },
  ],
}));

// jsdom does not implement canvas — stub getContext to keep RouletteWheel rendering.
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arc: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 0 })),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    canvas: { width: 400, height: 400 },
  }));
});

import RouletteWheel from '@/games/roulette/RouletteWheel';

describe('RouletteWheel', () => {
  it('renders a canvas with an accessible label', () => {
    render(<RouletteWheel />);
    const canvas = screen.getByRole('img', { name: /Roulette wheel/i });
    expect(canvas).toBeInTheDocument();
    expect(canvas.tagName).toBe('CANVAS');
  });

  it('does not show winning number overlay while spinning', () => {
    render(<RouletteWheel isSpinning={true} winningNumber={17} showResult={false} />);
    expect(screen.queryByText('17')).not.toBeInTheDocument();
  });

  it('shows the winning number overlay when showResult is true and not spinning', () => {
    render(<RouletteWheel isSpinning={false} winningNumber={17} showResult={true} />);
    expect(screen.getByText('17')).toBeInTheDocument();
  });

  it('does not throw when winningNumber is null', () => {
    expect(() => render(<RouletteWheel winningNumber={null} showResult={true} />)).not.toThrow();
  });
});
