import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import PeriodSelector from '@/components/admin/charts/PeriodSelector';

describe('PeriodSelector', () => {
  it('renders default period options as a button group', () => {
    render(<PeriodSelector value="30d" onChange={() => {}} />);
    expect(screen.getByRole('group', { name: /time period selector/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '24h' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '30d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '90d' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
  });

  it('marks the active period with aria-pressed=true', () => {
    render(<PeriodSelector value="7d" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: '7d' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '30d' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('calls onChange with the new value when a button is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<PeriodSelector value="30d" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: '7d' }));
    expect(onChange).toHaveBeenCalledWith('7d');
  });

  it('accepts a custom options list', () => {
    const opts = [
      { value: 'a', label: 'Alpha' },
      { value: 'b', label: 'Beta' },
    ];
    render(<PeriodSelector value="a" onChange={() => {}} options={opts} />);
    expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beta' })).toBeInTheDocument();
  });
});
