import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

/**
 * Themed tooltip matching casino dark UI.
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
 * Recharts AreaChart wrapped with casino theme defaults and gradient fills.
 *
 * @param {object} props
 * @param {Array} props.data - Chart data array
 * @param {string} props.xKey - Key for the x-axis values
 * @param {Array<{dataKey: string, color: string, name: string}>} props.areas - Area definitions
 * @param {number} [props.height=300] - Chart height in pixels
 * @param {function} [props.yAxisFormatter] - Formatter for y-axis tick labels
 * @param {function} [props.tooltipFormatter] - Formatter for tooltip values
 */
const AnalyticsAreaChart = ({
  data,
  xKey,
  areas,
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
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <defs>
          {areas.map((area) => (
            <linearGradient
              key={`gradient-${area.dataKey}`}
              id={`gradient-${area.dataKey}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="5%" stopColor={area.color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={area.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
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
        {areas.map((area, i) => (
          <Area
            key={area.dataKey || i}
            type="monotone"
            dataKey={area.dataKey}
            name={area.name}
            stroke={area.color}
            strokeWidth={2}
            fill={`url(#gradient-${area.dataKey})`}
            activeDot={{ r: 4 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default AnalyticsAreaChart;
