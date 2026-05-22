import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// Stub recharts with explicit named exports to avoid Proxy-based recursion.
vi.mock('recharts', async () => {
  const React = await import('react');
  const Stub = ({ children }) =>
    React.createElement('div', { 'data-testid': 'recharts-stub' }, children);
  return {
    ResponsiveContainer: Stub,
    LineChart: Stub,
    Line: Stub,
    BarChart: Stub,
    Bar: Stub,
    PieChart: Stub,
    Pie: Stub,
    Cell: Stub,
    AreaChart: Stub,
    Area: Stub,
    XAxis: Stub,
    YAxis: Stub,
    CartesianGrid: Stub,
    Tooltip: Stub,
    Legend: Stub,
  };
});

import AnalyticsLineChart from '@/components/admin/charts/AnalyticsLineChart';

describe('AnalyticsLineChart', () => {
  it('renders the no-data state when data is empty', () => {
    render(
      <AnalyticsLineChart
        data={[]}
        xKey="date"
        lines={[{ dataKey: 'value', color: '#fff', name: 'Value' }]}
      />
    );
    expect(screen.getByText(/No data available/i)).toBeInTheDocument();
  });

  it('renders the chart container when given valid data', () => {
    const data = [
      { date: '2025-05-01', value: 100 },
      { date: '2025-05-02', value: 200 },
    ];
    render(
      <AnalyticsLineChart
        data={data}
        xKey="date"
        lines={[{ dataKey: 'value', color: '#F59E0B', name: 'Value' }]}
      />
    );
    expect(screen.getAllByTestId('recharts-stub').length).toBeGreaterThan(0);
  });
});
