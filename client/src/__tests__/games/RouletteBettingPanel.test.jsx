import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

vi.mock('@/games/roulette/rouletteUtils', () => ({
  BET_TYPES: {
    STRAIGHT: { name: 'Straight', payout: 35 },
    RED: { name: 'Red', payout: 1 },
    BLACK: { name: 'Black', payout: 1 },
    ODD: { name: 'Odd', payout: 1 },
    EVEN: { name: 'Even', payout: 1 },
    LOW: { name: 'Low', payout: 1 },
    HIGH: { name: 'High', payout: 1 },
    DOZEN: { name: 'Dozen', payout: 2 },
    COLUMN: { name: 'Column', payout: 2 },
  },
  ROULETTE_NUMBERS: [
    { number: 0, color: 'green' },
    { number: 1, color: 'red' },
    { number: 2, color: 'black' },
    { number: 7, color: 'red' },
  ],
}));

import RouletteBettingPanel from '@/games/roulette/RouletteBettingPanel';

const renderPanel = (overrides = {}) => {
  const props = {
    betAmount: 10,
    setBetAmount: vi.fn(),
    onPlaceBet: vi.fn(),
    isSpinning: false,
    balance: 500,
    ...overrides,
  };
  const utils = render(<RouletteBettingPanel {...props} />);
  return { ...utils, props };
};

describe('RouletteBettingPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders bet input and Place Bet button', () => {
    renderPanel();
    expect(screen.getByLabelText(/Bet Amount/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Place Bet/i })).toBeInTheDocument();
  });

  it('calls setBetAmount with the parsed numeric value', () => {
    const { props } = renderPanel();
    fireEvent.change(screen.getByLabelText(/Bet Amount/i), { target: { value: '75' } });
    expect(props.setBetAmount).toHaveBeenCalledWith(75);
  });

  it('coerces NaN bet input to 0', () => {
    const { props } = renderPanel();
    fireEvent.change(screen.getByLabelText(/Bet Amount/i), { target: { value: '' } });
    expect(props.setBetAmount).toHaveBeenCalledWith(0);
  });

  it('disables inputs and presets while spinning', () => {
    renderPanel({ isSpinning: true });
    expect(screen.getByLabelText(/Bet Amount/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: '25' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Wheel Spinning/i })).toBeDisabled();
  });

  it('emits onPlaceBet with the default straight bet (number 0)', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Place Bet/i }));
    expect(props.onPlaceBet).toHaveBeenCalledWith({
      type: 'STRAIGHT',
      value: '0',
      amount: 10,
    });
  });

  it('emits onPlaceBet with a different straight number when selected', () => {
    const { props } = renderPanel();
    // Select number 7 from the number grid
    fireEvent.click(screen.getByRole('button', { name: '7' }));
    fireEvent.click(screen.getByRole('button', { name: /Place Bet/i }));
    expect(props.onPlaceBet).toHaveBeenCalledWith({
      type: 'STRAIGHT',
      value: '7',
      amount: 10,
    });
  });

  it('emits onPlaceBet with bet type RED for outside bets', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Red/i }));
    fireEvent.click(screen.getByRole('button', { name: /Place Bet/i }));
    expect(props.onPlaceBet).toHaveBeenCalledWith(expect.objectContaining({
      type: 'RED',
      amount: 10,
    }));
  });

  it('does not emit onPlaceBet when betAmount is 0 or negative', () => {
    const { props } = renderPanel({ betAmount: 0 });
    fireEvent.click(screen.getByRole('button', { name: /Place Bet/i }));
    expect(props.onPlaceBet).not.toHaveBeenCalled();
  });

  it('does not emit onPlaceBet while spinning', () => {
    const { props } = renderPanel({ isSpinning: true });
    fireEvent.click(screen.getByRole('button', { name: /Wheel Spinning/i }));
    expect(props.onPlaceBet).not.toHaveBeenCalled();
  });
});
