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

import AnalyticsBarChart from '@/components/admin/charts/AnalyticsBarChart';

describe('AnalyticsBarChart', () => {
  it('renders the no-data state when data is empty', () => {
    render(
      <AnalyticsBarChart
        data={[]}
        xKey="game"
        bars={[{ dataKey: 'profit', color: '#fff', name: 'Profit' }]}
      />
    );
    expect(screen.getByText(/No data available/i)).toBeInTheDocument();
  });

  it('renders the chart container when given valid data', () => {
    const data = [
      { game: 'Crash', profit: 500 },
      { game: 'Roulette', profit: 300 },
    ];
    render(
      <AnalyticsBarChart
        data={data}
        xKey="game"
        bars={[{ dataKey: 'profit', color: '#F59E0B', name: 'Profit' }]}
      />
    );
    expect(screen.getAllByTestId('recharts-stub').length).toBeGreaterThan(0);
  });
});
