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
    ...Array.from({ length: 34 }, (_, i) => ({
      number: i + 3,
      color: (i + 3) % 2 === 0 ? 'black' : 'red',
    })),
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

  it('renders the felt bet board with outside bets', () => {
    renderPanel();
    expect(screen.getByLabelText(/Bet Amount/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Place bet on Red/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Place bet on Black/i })).toBeInTheDocument();
  });

  it('calls setBetAmount when the chip-value input changes', () => {
    const { props } = renderPanel();
    fireEvent.change(screen.getByLabelText(/Bet Amount/i), { target: { value: '75' } });
    expect(props.setBetAmount).toHaveBeenCalledWith(75);
  });

  it('coerces NaN chip input to 0', () => {
    const { props } = renderPanel();
    fireEvent.change(screen.getByLabelText(/Bet Amount/i), { target: { value: '' } });
    expect(props.setBetAmount).toHaveBeenCalledWith(0);
  });

  it('disables board cells and chip presets while spinning', () => {
    renderPanel({ isSpinning: true });
    expect(screen.getByLabelText(/Bet Amount/i)).toBeDisabled();
    expect(screen.getByRole('button', { name: /Place bet on Red/i })).toBeDisabled();
  });

  it('emits onPlaceBet for a straight bet when clicking the 0 cell', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Place bet on 0/i }));
    expect(props.onPlaceBet).toHaveBeenCalledWith({
      type: 'STRAIGHT',
      value: '0',
      amount: 10,
    });
  });

  it('emits onPlaceBet for a straight number cell', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Place bet on 7/i }));
    expect(props.onPlaceBet).toHaveBeenCalledWith({
      type: 'STRAIGHT',
      value: '7',
      amount: 10,
    });
  });

  it('emits onPlaceBet with bet type RED for outside bets', () => {
    const { props } = renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /Place bet on Red/i }));
    expect(props.onPlaceBet).toHaveBeenCalledWith(expect.objectContaining({
      type: 'RED',
      amount: 10,
    }));
  });

  it('does not emit onPlaceBet when betAmount is 0', () => {
    const { props } = renderPanel({ betAmount: 0 });
    fireEvent.click(screen.getByRole('button', { name: /Place bet on Red/i }));
    expect(props.onPlaceBet).not.toHaveBeenCalled();
  });

  it('does not emit onPlaceBet while spinning', () => {
    const { props } = renderPanel({ isSpinning: true });
    // Cell is disabled — clicking should be a no-op.
    fireEvent.click(screen.getByRole('button', { name: /Place bet on Red/i }));
    expect(props.onPlaceBet).not.toHaveBeenCalled();
  });

  it('does not emit onPlaceBet when bet amount exceeds balance', () => {
    const { props } = renderPanel({ betAmount: 1000, balance: 50 });
    fireEvent.click(screen.getByRole('button', { name: /Place bet on Red/i }));
    expect(props.onPlaceBet).not.toHaveBeenCalled();
  });
});
