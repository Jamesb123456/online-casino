import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import BlackjackPayoutEditor from '@/components/admin/payoutEditors/BlackjackPayoutEditor';

const Wrapper = ({ initial, onChangeSpy }) => {
  const [table, setTable] = useState(initial);
  return (
    <BlackjackPayoutEditor
      payoutTable={table}
      onChange={(next) => {
        onChangeSpy?.(next);
        setTable(next);
      }}
      houseEdge={0.02}
    />
  );
};

describe('BlackjackPayoutEditor', () => {
  it('renders inputs for win/blackjack/push', () => {
    render(<Wrapper initial={{ win: 2, blackjack: 2.5, push: 1 }} />);
    expect(screen.getByTestId('blackjack-input-win')).toHaveValue(2);
    expect(screen.getByTestId('blackjack-input-blackjack')).toHaveValue(2.5);
    expect(screen.getByTestId('blackjack-input-push')).toHaveValue(1);
  });

  it('calls onChange when win is edited', () => {
    const spy = vi.fn();
    render(<Wrapper initial={{ win: 2, blackjack: 2.5, push: 1 }} onChangeSpy={spy} />);
    fireEvent.change(screen.getByTestId('blackjack-input-win'), { target: { value: '1.8' } });
    expect(spy).toHaveBeenCalledWith({ win: 1.8, blackjack: 2.5, push: 1 });
  });

  it('updates RTP preview when payouts change', () => {
    render(<Wrapper initial={{ win: 2, blackjack: 2.5, push: 1 }} />);
    const before = screen.getByTestId('rtp-value').textContent;
    fireEvent.change(screen.getByTestId('blackjack-input-blackjack'), { target: { value: '3' } });
    const after = screen.getByTestId('rtp-value').textContent;
    expect(before).not.toEqual(after);
  });
});
