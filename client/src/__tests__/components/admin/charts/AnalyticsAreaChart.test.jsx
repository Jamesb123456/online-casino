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

import AnalyticsAreaChart from '@/components/admin/charts/AnalyticsAreaChart';

describe('AnalyticsAreaChart', () => {
  it('renders the no-data state when data is empty', () => {
    render(
      <AnalyticsAreaChart
        data={[]}
        xKey="date"
        areas={[{ dataKey: 'revenue', color: '#10B981', name: 'Revenue' }]}
      />
    );
    expect(screen.getByText(/No data available/i)).toBeInTheDocument();
  });

  it('renders the chart container when given valid data', () => {
    const data = [
      { date: '2025-05-01', revenue: 100 },
      { date: '2025-05-02', revenue: 200 },
    ];
    render(
      <AnalyticsAreaChart
        data={data}
        xKey="date"
        areas={[{ dataKey: 'revenue', color: '#10B981', name: 'Revenue' }]}
      />
    );
    expect(screen.getAllByTestId('recharts-stub').length).toBeGreaterThan(0);
  });
});
