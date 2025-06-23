import React from 'react';
import Card from '../../components/ui/Card';
import { formatMultiplier, getMultiplierColor } from './crashUtils';

const CrashHistory = ({ history = [] }) => {
  // Format timestamp to readable time
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card title="Game History">
      <div className="flex flex-wrap gap-2">
        {history.map((game) => (
          <div 
            key={game.id} 
            className="flex flex-col items-center p-2 rounded-md bg-gray-700 w-16"
          >
            <span 
              className="text-lg font-bold" 
              style={{ color: getMultiplierColor(game.crashPoint) }}
            >
              {formatMultiplier(game.crashPoint)}
            </span>
            <span className="text-xs text-gray-400">{formatTime(game.timestamp)}</span>
          </div>
        ))}

        {history.length === 0 && (
          <div className="text-gray-400 text-center w-full py-4">
            No recent games found
          </div>
        )}
      </div>

      {/* Game statistics */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-3 gap-4">
          <StatCard 
            title="Highest" 
            value={Math.max(...history.map(g => g.crashPoint)).toFixed(2) + 'x'}
            color="text-green-500" 
          />
          <StatCard 
            title="Average" 
            value={(history.reduce((acc, g) => acc + g.crashPoint, 0) / Math.max(1, history.length)).toFixed(2) + 'x'}
            color="text-amber-400" 
          />
          <StatCard 
            title="Lowest" 
            value={Math.min(...(history.length ? history.map(g => g.crashPoint) : [0])).toFixed(2) + 'x'}
            color="text-red-500" 
          />
        </div>
      </div>
    </Card>
  );
};

// Helper component for statistics
const StatCard = ({ title, value, color }) => (
  <div className="bg-gray-800 rounded p-2 text-center">
    <div className="text-sm text-gray-400">{title}</div>
    <div className={`text-lg font-bold ${color}`}>{value}</div>
  </div>
);

export default CrashHistory;