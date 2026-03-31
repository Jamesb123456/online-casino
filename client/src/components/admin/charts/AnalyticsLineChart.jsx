import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

/**
 * Themed tooltip that matches the casino dark UI.
 * Shared internally by chart components.
 */
const CustomTooltip = ({ active, payload, label, formatter }) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="bg-bg-card border border-white/10 rounded-lg p-3 shadow-lg">
      <p className="text-text-secondary text-xs mb-2">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatter ? formatter(entry.value) : entry.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

/**
 * Recharts LineChart wrapped with casino theme defaults.
 *
 * @param {object} props
 * @param {Array} props.data - Chart data array
 * @param {string} props.xKey - Key for the x-axis values
 * @param {Array<{dataKey: string, color: string, name: string}>} props.lines - Line definitions
 * @param {number} [props.height=300] - Chart height in pixels
 * @param {function} [props.yAxisFormatter] - Formatter for y-axis tick labels
 * @param {function} [props.tooltipFormatter] - Formatter for tooltip values
 */
const AnalyticsLineChart = ({
  data,
  xKey,
  lines,
  height = 300,
  yAxisFormatter,
  tooltipFormatter,
}) => {
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
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1E2A3A" />
        <XAxis
          dataKey={xKey}
          stroke="#94A3B8"
          tick={{ fontSize: 12 }}
        />
        <YAxis
          stroke="#94A3B8"
          tick={{ fontSize: 12 }}
          tickFormatter={yAxisFormatter}
        />
        <Tooltip content={<CustomTooltip formatter={tooltipFormatter} />} />
        <Legend wrapperStyle={{ fontSize: '12px', color: '#94A3B8' }} />
        {lines.map((line, i) => (
          <Line
            key={line.dataKey || i}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name}
            stroke={line.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

export default AnalyticsLineChart;
