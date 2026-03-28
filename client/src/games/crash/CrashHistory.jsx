import React from 'react';
import { formatMultiplier, getMultiplierColor } from './crashUtils';

const CrashHistory = ({ history = [] }) => {
  // Format timestamp to readable time
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden p-4">
      <h3 className="text-lg font-heading font-bold text-text-primary mb-3">Game History</h3>
      <div className="flex flex-wrap gap-2">
        {history.map((game) => (
          <div
            key={game.id}
            className="flex flex-col items-center p-2 rounded-lg bg-bg-elevated w-16"
          >
            <span
              className="text-lg font-heading font-bold"
              style={{ color: getMultiplierColor(game.crashPoint) }}
            >
              {formatMultiplier(game.crashPoint)}
            </span>
            <span className="text-xs text-text-muted">{formatTime(game.timestamp)}</span>
          </div>
        ))}

        {history.length === 0 && (
          <div className="text-text-muted text-center w-full py-4">
            No recent games found
          </div>
        )}
      </div>

      {/* Game statistics */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="grid grid-cols-3 gap-3">
          <StatCard
            title="Highest"
            value={Math.max(...history.map(g => g.crashPoint)).toFixed(2) + 'x'}
            color="text-status-success"
          />
          <StatCard
            title="Average"
            value={(history.reduce((acc, g) => acc + g.crashPoint, 0) / Math.max(1, history.length)).toFixed(2) + 'x'}
            color="text-accent-gold"
          />
          <StatCard
            title="Lowest"
            value={Math.min(...(history.length ? history.map(g => g.crashPoint) : [0])).toFixed(2) + 'x'}
            color="text-status-error"
          />
        </div>
      </div>
    </div>
  );
};

// Helper component for statistics
const StatCard = ({ title, value, color }) => (
  <div className="bg-bg-elevated rounded-lg p-3 text-center">
    <div className="text-xs text-text-muted">{title}</div>
    <div className={`text-lg font-heading font-bold ${color}`}>{value}</div>
  </div>
);

export default CrashHistory;