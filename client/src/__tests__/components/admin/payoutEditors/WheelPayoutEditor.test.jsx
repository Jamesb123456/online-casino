import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import WheelPayoutEditor from '@/components/admin/payoutEditors/WheelPayoutEditor';

const Wrapper = ({ initial, onChangeSpy }) => {
  const [table, setTable] = useState(initial);
  return (
    <WheelPayoutEditor
      payoutTable={table}
      onChange={(next) => {
        onChangeSpy?.(next);
        setTable(next);
      }}
      houseEdge={0}
    />
  );
};

const baseTable = {
  easy: [0, 1, 2],
  medium: [0, 0, 5],
  hard: [0, 0, 0, 10],
};

describe('WheelPayoutEditor', () => {
  it('renders segments for the active difficulty', () => {
    render(<Wrapper initial={baseTable} />);
    expect(screen.getByTestId('wheel-input-easy-0')).toBeInTheDocument();
    expect(screen.getByTestId('wheel-input-easy-1')).toBeInTheDocument();
    expect(screen.getByTestId('wheel-input-easy-2')).toBeInTheDocument();
  });

  it('switches difficulty tabs and shows the matching segments', () => {
    render(<Wrapper initial={baseTable} />);
    fireEvent.click(screen.getByTestId('wheel-tab-hard'));
    expect(screen.getByTestId('wheel-input-hard-3')).toBeInTheDocument();
  });

  it('preserves edits when switching tabs', () => {
    const spy = vi.fn();
    render(<Wrapper initial={baseTable} onChangeSpy={spy} />);
    fireEvent.change(screen.getByTestId('wheel-input-easy-1'), { target: { value: '4' } });
    expect(spy).toHaveBeenCalledWith({
      ...baseTable,
      easy: [0, 4, 2],
    });
    // Switch tabs and back
    fireEvent.click(screen.getByTestId('wheel-tab-medium'));
    fireEvent.click(screen.getByTestId('wheel-tab-easy'));
    expect(screen.getByTestId('wheel-input-easy-1').value).toBe('4');
  });

  it('adds a new segment', () => {
    const spy = vi.fn();
    render(<Wrapper initial={baseTable} onChangeSpy={spy} />);
    fireEvent.click(screen.getByRole('button', { name: /Add segment/i }));
    expect(spy).toHaveBeenCalledWith({
      ...baseTable,
      easy: [0, 1, 2, 0],
    });
  });

  it('removes the last segment', () => {
    const spy = vi.fn();
    render(<Wrapper initial={baseTable} onChangeSpy={spy} />);
    fireEvent.click(screen.getByRole('button', { name: /Remove last/i }));
    expect(spy).toHaveBeenCalledWith({
      ...baseTable,
      easy: [0, 1],
    });
  });
});
