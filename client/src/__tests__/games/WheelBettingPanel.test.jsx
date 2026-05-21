import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('@/games/wheel/wheelUtils', () => ({
  formatMultiplier: (m) => `${Number(m).toFixed(2)}x`,
}));

import WheelBettingPanel from '@/games/wheel/WheelBettingPanel';

const renderPanel = (overrides = {}) => {
  const props = {
    betAmount: 10,
    setBetAmount: vi.fn(),
    difficulty: 'medium',
    setDifficulty: vi.fn(),
    onSpin: vi.fn(),
    isSpinning: false,
    maxMultiplier: 5,
    ...overrides,
  };
  const utils = render(<WheelBettingPanel {...props} />);
  return { ...utils, props };
};

describe('WheelBettingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders bet input and Spin button', () => {
    renderPanel();
    expect(screen.getByLabelText(/Bet Amount/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Spin the Wheel/i })).toBeInTheDocument();
  });

  it('calls setBetAmount with the parsed value', () => {
    const { props } = renderPanel();
    fireEvent.change(screen.getByLabelText(/Bet Amount/i), { target: { value: '33' } });
    expect(props.setBetAmount).toHaveBeenCalledWith(33);
  });

  it('coerces NaN bet input to 0', () => {
    const { props } = renderPanel();
    fireEvent.change(screen.getByLabelText(/Bet Amount/i), { target: { value: '' } });
    expect(props.setBetAmount).toHaveBeenCalledWith(0);
  });

  it('selecting a preset updates the bet amount', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: '100' }));
    expect(props.setBetAmount).toHaveBeenCalledWith(100);
  });

  it('changing difficulty calls setDifficulty', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /hard/i }));
    expect(props.setDifficulty).toHaveBeenCalledWith('hard');
  });

  it('clicking Spin invokes onSpin', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Spin the Wheel/i }));
    expect(props.onSpin).toHaveBeenCalledTimes(1);
  });

  it('disables controls when isSpinning is true', () => {
    renderPanel({ isSpinning: true });
    expect(screen.getByLabelText(/Bet Amount/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: '50' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Spinning/i })).toBeDisabled();
  });

  it('disables Spin when betAmount is 0', () => {
    renderPanel({ betAmount: 0 });
    expect(screen.getByRole('button', { name: /Spin the Wheel/i })).toBeDisabled();
  });
});
