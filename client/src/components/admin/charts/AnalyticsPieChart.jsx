import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

/**
 * Themed tooltip matching casino dark UI.
 */
const CustomTooltip = ({ active, payload, formatter }) => {
  if (!active || !payload?.length) return null;

  const entry = payload[0];
  return (
    <div className="bg-bg-card border border-white/10 rounded-lg p-3 shadow-lg">
      <p className="text-sm" style={{ color: entry.payload.color }}>
        {entry.name}: {formatter ? formatter(entry.value) : entry.value?.toLocaleString()}
      </p>
    </div>
  );
};

/**
 * Custom label renderer showing percentage on each slice.
 */
const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null; // Skip labels for very small slices

  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#F1F5F9"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={12}
      fontWeight={600}
    >
      {(percent * 100).toFixed(0)}%
    </text>
  );
};

/**
 * Recharts PieChart wrapped with casino theme defaults.
 *
 * @param {object} props
 * @param {Array<{name: string, value: number, color: string}>} props.data - Pie slice data
 * @param {number} [props.height=300] - Chart height in pixels
 * @param {function} [props.tooltipFormatter] - Formatter for tooltip values
 */
const AnalyticsPieChart = ({ data, height = 300, tooltipFormatter }) => {
  if (!data?.length) {
    return (
      <div
        className="flex items-center justify-center text-text-muted"
        style={{ height }}
        role="status"
      >
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomLabel}
          outerRadius={100}
          dataKey="value"
          stroke="#0B0E17"
          strokeWidth={2}
        >
          {data.map((entry, i) => (
            <Cell key={`cell-${i}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip formatter={tooltipFormatter} />} />
        <Legend
          wrapperStyle={{ fontSize: '12px', color: '#94A3B8' }}
          formatter={(value) => <span style={{ color: '#94A3B8' }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default AnalyticsPieChart;
