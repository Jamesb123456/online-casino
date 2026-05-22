import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import RoulettePayoutEditor from '@/components/admin/payoutEditors/RoulettePayoutEditor';

const Wrapper = ({ initial, onChangeSpy }) => {
  const [table, setTable] = useState(initial);
  return (
    <RoulettePayoutEditor
      payoutTable={table}
      onChange={(next) => {
        onChangeSpy?.(next);
        setTable(next);
      }}
      houseEdge={0.027}
    />
  );
};

describe('RoulettePayoutEditor', () => {
  it('renders sorted rows for the initial payoutTable', () => {
    render(<Wrapper initial={{ STRAIGHT: 35, RED: 1, BLACK: 1 }} />);
    const rows = screen.getAllByRole('row');
    // header + 3 data rows
    expect(rows.length).toBeGreaterThanOrEqual(4);
    expect(screen.getByTestId('row-BLACK')).toBeInTheDocument();
    expect(screen.getByTestId('row-RED')).toBeInTheDocument();
    expect(screen.getByTestId('row-STRAIGHT')).toBeInTheDocument();
  });

  it('calls onChange when a multiplier is edited', () => {
    const spy = vi.fn();
    render(<Wrapper initial={{ RED: 1 }} onChangeSpy={spy} />);
    const input = screen.getByTestId('input-RED');
    fireEvent.change(input, { target: { value: '2' } });
    expect(spy).toHaveBeenCalledWith({ RED: 2 });
  });

  it('updates the RTP preview when a multiplier changes', () => {
    render(<Wrapper initial={{ RED: 1 }} />);
    const rtpBefore = screen.getByTestId('rtp-value').textContent;
    fireEvent.change(screen.getByTestId('input-RED'), { target: { value: '3' } });
    const rtpAfter = screen.getByTestId('rtp-value').textContent;
    expect(rtpBefore).not.toEqual(rtpAfter);
  });

  it('adds a new bet type via the form', () => {
    const spy = vi.fn();
    render(<Wrapper initial={{ RED: 1 }} onChangeSpy={spy} />);
    fireEvent.change(screen.getByLabelText('New bet type'), { target: { value: 'street' } });
    fireEvent.change(screen.getByLabelText('Multiplier'), { target: { value: '11' } });
    fireEvent.click(screen.getByRole('button', { name: /Add bet type/i }));
    expect(spy).toHaveBeenCalledWith({ RED: 1, STREET: 11 });
  });

  it('deletes a bet type after confirmation', () => {
    const spy = vi.fn();
    render(<Wrapper initial={{ RED: 1, BLACK: 1 }} onChangeSpy={spy} />);
    const row = screen.getByTestId('row-BLACK');
    fireEvent.click(row.querySelector('button'));
    // Confirm button now visible
    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));
    expect(spy).toHaveBeenCalledWith({ RED: 1 });
  });
});
