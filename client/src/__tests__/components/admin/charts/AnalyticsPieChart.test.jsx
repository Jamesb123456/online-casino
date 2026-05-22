import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

vi.mock('recharts', async () => {
  const React = await import('react');
  const Stub = ({ children }) =>
    React.createElement('div', { 'data-testid': 'recharts-stub' }, children);
  return {
    ResponsiveContainer: Stub,
    LineChart: Stub, Line: Stub,
    BarChart: Stub, Bar: Stub,
    PieChart: Stub, Pie: Stub, Cell: Stub,
    AreaChart: Stub, Area: Stub,
    XAxis: Stub, YAxis: Stub,
    CartesianGrid: Stub, Tooltip: Stub, Legend: Stub,
  };
});

import AnalyticsPieChart from '@/components/admin/charts/AnalyticsPieChart';

describe('AnalyticsPieChart', () => {
  it('renders the no-data state when data is empty', () => {
    render(<AnalyticsPieChart data={[]} />);
    expect(screen.getByText(/No data available/i)).toBeInTheDocument();
  });

  it('renders the chart container when given valid data', () => {
    const data = [
      { name: 'Crash', value: 600, color: '#EF4444' },
      { name: 'Roulette', value: 400, color: '#10B981' },
    ];
    render(<AnalyticsPieChart data={data} />);
    expect(screen.getAllByTestId('recharts-stub').length).toBeGreaterThan(0);
  });
});
