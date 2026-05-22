import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import StatCard from '@/components/admin/charts/StatCard';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="Total Players" value="42" />);
    expect(screen.getByText('Total Players')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders the icon when provided', () => {
    render(<StatCard label="Players" value="10" icon="👥" />);
    expect(screen.getByText('👥')).toBeInTheDocument();
  });

  it('renders a positive change badge with a leading +', () => {
    render(<StatCard label="Revenue" value="$100" change={12.5} />);
    expect(screen.getByText('+12.5%')).toBeInTheDocument();
  });

  it('renders a negative change badge without a + prefix', () => {
    render(<StatCard label="Revenue" value="$100" change={-3.2} />);
    expect(screen.getByText('-3.2%')).toBeInTheDocument();
  });

  it('renders the changeLabel context line when provided', () => {
    render(
      <StatCard label="Revenue" value="$100" change={5} changeLabel="vs last period" />
    );
    expect(screen.getByText('vs last period')).toBeInTheDocument();
  });

  it('omits the change badge when change is undefined', () => {
    render(<StatCard label="Players" value="42" />);
    // No percent badge should appear
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });
});
