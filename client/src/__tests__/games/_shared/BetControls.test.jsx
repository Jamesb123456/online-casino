import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BetControls from '@/games/_shared/BetControls';

function Wrapper({ initialValue = 10, ...rest }) {
  const [v, setV] = useState(initialValue);
  return <BetControls value={v} onChange={setV} {...rest} />;
}

describe('BetControls', () => {
  it('renders the primary action label', () => {
    render(
      <BetControls
        value={10}
        onChange={() => {}}
        min={1}
        max={100}
        balance={500}
        primaryAction={() => {}}
        primaryLabel="Roll"
      />
    );
    expect(screen.getByRole('button', { name: 'Roll' })).toBeInTheDocument();
  });

  it('renders the secondary action when secondaryAction is provided', () => {
    render(
      <BetControls
        value={10}
        onChange={() => {}}
        min={1}
        max={100}
        balance={500}
        primaryAction={() => {}}
        primaryLabel="Roll"
        secondaryAction={() => {}}
        secondaryLabel="Cashout"
      />
    );
    expect(screen.getByRole('button', { name: 'Cashout' })).toBeInTheDocument();
  });

  it('does NOT render secondary when no secondaryAction', () => {
    render(
      <BetControls
        value={10}
        onChange={() => {}}
        min={1}
        max={100}
        balance={500}
        primaryAction={() => {}}
        primaryLabel="Roll"
        secondaryLabel="Cashout"
      />
    );
    expect(screen.queryByRole('button', { name: 'Cashout' })).not.toBeInTheDocument();
  });

  it('clamps numeric input to min on blur for values below min', () => {
    const onChange = vi.fn();
    render(
      <BetControls
        value={50}
        onChange={onChange}
        min={5}
        max={500}
        balance={1000}
        primaryAction={() => {}}
      />
    );
    const input = screen.getByLabelText(/bet amount/i);
    // Trigger change with below-min value -> component clamps via onChange
    fireEvent.change(input, { target: { value: '1' } });
    expect(onChange).toHaveBeenLastCalledWith(5);
  });

  it('clamps numeric input to max', () => {
    const onChange = vi.fn();
    render(
      <BetControls
        value={50}
        onChange={onChange}
        min={5}
        max={500}
        balance={1000}
        primaryAction={() => {}}
      />
    );
    const input = screen.getByLabelText(/bet amount/i);
    fireEvent.change(input, { target: { value: '99999' } });
    expect(onChange).toHaveBeenLastCalledWith(500);
  });

  it('quick amount chips call onChange with the chip value', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <BetControls
        value={10}
        onChange={onChange}
        min={1}
        max={1000}
        balance={5000}
        quickAmounts={[10, 50, 100]}
        primaryAction={() => {}}
      />
    );
    await user.click(screen.getByRole('button', { name: '50' }));
    expect(onChange).toHaveBeenCalledWith(50);
  });

  it('halve and double buttons compute correctly and respect bounds', async () => {
    const user = userEvent.setup();
    render(
      <Wrapper
        initialValue={40}
        min={5}
        max={100}
        balance={1000}
        halveDouble
        primaryAction={() => {}}
      />
    );

    const halve = screen.getByRole('button', { name: /halve bet/i });
    const double = screen.getByRole('button', { name: /double bet/i });
    const input = screen.getByLabelText(/bet amount/i);

    await user.click(halve); // 40 -> 20
    expect(input).toHaveValue(20);

    await user.click(double); // 20 -> 40
    expect(input).toHaveValue(40);

    await user.click(double); // 40 -> 80
    expect(input).toHaveValue(80);

    await user.click(double); // 160 -> clamps to max=100
    expect(input).toHaveValue(100);
  });

  it('disables primary when balance < min', () => {
    render(
      <BetControls
        value={10}
        onChange={() => {}}
        min={50}
        max={500}
        balance={10}
        primaryAction={() => {}}
        primaryLabel="Bet"
      />
    );
    expect(screen.getByRole('button', { name: 'Bet' })).toBeDisabled();
  });

  it('disables primary when primaryDisabled is true', () => {
    render(
      <BetControls
        value={10}
        onChange={() => {}}
        min={1}
        max={500}
        balance={500}
        primaryAction={() => {}}
        primaryDisabled
        primaryLabel="Bet"
      />
    );
    expect(screen.getByRole('button', { name: 'Bet' })).toBeDisabled();
  });

  it('renders status text when provided', () => {
    render(
      <BetControls
        value={10}
        onChange={() => {}}
        min={1}
        max={500}
        balance={500}
        primaryAction={() => {}}
        status="Awaiting next round"
      />
    );
    expect(screen.getByText('Awaiting next round')).toBeInTheDocument();
  });

  it('renders children slot content', () => {
    render(
      <BetControls
        value={10}
        onChange={() => {}}
        min={1}
        max={500}
        balance={500}
        primaryAction={() => {}}
      >
        <div data-testid="custom-control">extra</div>
      </BetControls>
    );
    expect(screen.getByTestId('custom-control')).toBeInTheDocument();
  });
});
