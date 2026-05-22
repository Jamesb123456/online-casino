import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import PlinkoPayoutEditor from '@/components/admin/payoutEditors/PlinkoPayoutEditor';

const baseTable = {
  low:    { 8: [2.5, 1.4, 1.1, 0.9, 0.8, 0.9, 1.1, 1.4, 2.5] },
  medium: { 8: [5.6, 2.1, 1.1, 0.7, 0.5, 0.7, 1.1, 2.1, 5.6] },
  high:   { 8: [15, 4, 1.5, 0.5, 0.3, 0.5, 1.5, 4, 15] },
};

const Wrapper = ({ initial, onChangeSpy }) => {
  const [table, setTable] = useState(initial);
  return (
    <PlinkoPayoutEditor
      payoutTable={table}
      onChange={(next) => {
        onChangeSpy?.(next);
        setTable(next);
      }}
      houseEdge={0}
    />
  );
};

describe('PlinkoPayoutEditor', () => {
  it('renders buckets for low/8 by default', () => {
    render(<Wrapper initial={baseTable} />);
    for (let i = 0; i < 9; i += 1) {
      expect(screen.getByTestId(`plinko-input-low-8-${i}`)).toBeInTheDocument();
    }
  });

  it('switches risk tab', () => {
    render(<Wrapper initial={baseTable} />);
    fireEvent.click(screen.getByTestId('plinko-risk-high'));
    expect(screen.getByTestId('plinko-input-high-8-0')).toBeInTheDocument();
  });

  it('updates a bucket multiplier via onChange', () => {
    const spy = vi.fn();
    render(<Wrapper initial={baseTable} onChangeSpy={spy} />);
    fireEvent.change(screen.getByTestId('plinko-input-low-8-0'), { target: { value: '3.5' } });
    expect(spy).toHaveBeenCalled();
    const lastCall = spy.mock.calls[spy.mock.calls.length - 1][0];
    expect(lastCall.low['8'][0]).toBe(3.5);
  });

  it('updates RTP preview when a bucket changes', () => {
    render(<Wrapper initial={baseTable} />);
    const before = screen.getByTestId('rtp-value').textContent;
    fireEvent.change(screen.getByTestId('plinko-input-low-8-0'), { target: { value: '50' } });
    const after = screen.getByTestId('rtp-value').textContent;
    expect(before).not.toEqual(after);
  });
});
