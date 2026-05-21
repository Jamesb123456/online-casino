import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('@/games/plinko/plinkoUtils', () => ({
  getPlinkoMultipliers: (risk) => {
    if (risk === 'low') return [0.5, 1, 1.2, 2];
    if (risk === 'high') return [0.3, 1, 5, 50];
    return [0.5, 1, 2, 10];
  },
}));

import PlinkoBettingPanel from '@/games/plinko/PlinkoBettingPanel';

const renderPanel = (overrides = {}) => {
  const props = {
    betAmount: 10,
    setBetAmount: vi.fn(),
    risk: 'medium',
    setRisk: vi.fn(),
    onPlaceBet: vi.fn(),
    isAnimating: false,
    ...overrides,
  };
  const utils = render(<PlinkoBettingPanel {...props} />);
  return { ...utils, props };
};

describe('PlinkoBettingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders bet input and Drop Ball button', () => {
    renderPanel();
    expect(screen.getByLabelText(/Bet Amount/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Drop Ball/i })).toBeInTheDocument();
  });

  it('calls setBetAmount with the numeric value', () => {
    const { props } = renderPanel();
    fireEvent.change(screen.getByLabelText(/Bet Amount/i), { target: { value: '42' } });
    expect(props.setBetAmount).toHaveBeenCalledWith(42);
  });

  it('coerces NaN bet input to 0', () => {
    const { props } = renderPanel();
    fireEvent.change(screen.getByLabelText(/Bet Amount/i), { target: { value: '' } });
    expect(props.setBetAmount).toHaveBeenCalledWith(0);
  });

  it('selecting a preset calls setBetAmount with that preset', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '50' }));
    expect(props.setBetAmount).toHaveBeenCalledWith(50);
  });

  it('changing the risk level calls setRisk', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /high/i }));
    expect(props.setRisk).toHaveBeenCalledWith('high');
  });

  it('clicking Drop Ball calls onPlaceBet', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Drop Ball/i }));
    expect(props.onPlaceBet).toHaveBeenCalledTimes(1);
  });

  it('disables Drop Ball while animating', () => {
    renderPanel({ isAnimating: true });
    expect(screen.getByRole('button', { name: /Ball Dropping/i })).toBeDisabled();
  });

  it('disables Drop Ball when betAmount is 0 or negative', () => {
    renderPanel({ betAmount: 0 });
    expect(screen.getByRole('button', { name: /Drop Ball/i })).toBeDisabled();

    renderPanel({ betAmount: -5 });
    const btns = screen.getAllByRole('button', { name: /Drop Ball/i });
    expect(btns[btns.length - 1]).toBeDisabled();
  });
});
