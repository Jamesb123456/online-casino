import React from 'react';
import Card from '../../components/ui/Card';
import { formatMultiplier } from './crashUtils';

/**
 * Component to display all active bets in the Crash game
 */
const CrashActiveBets = ({ bets = [], currentMultiplier = 1 }) => {
  if (!bets || bets.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="text-lg font-bold mb-2">Active Bets</h3>
        <p className="text-gray-400 text-sm">No active bets</p>
      </Card>
    );
  }

  // Sort bets by amount (highest first)
  const sortedBets = [...bets].sort((a, b) => b.amount - a.amount);

  return (
    <Card className="p-4">
      <h3 className="text-lg font-bold mb-2">Active Bets ({bets.length})</h3>
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-400 border-b border-gray-700">
              <th className="text-left py-2">Player</th>
              <th className="text-right py-2">Bet</th>
              <th className="text-right py-2">Auto Cash</th>
              <th className="text-right py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedBets.map((bet) => {
              // Determine bet status
              let status = 'Active';
              let statusColor = 'text-yellow-500';
              
              if (bet.cashedOut) {
                status = `${formatMultiplier(bet.cashedOutAt)}x`;
                statusColor = 'text-green-500';
              }
              
              return (
                <tr key={bet.userId} className="border-b border-gray-800">
                  <td className="py-2 flex items-center">
                    {bet.avatar ? (
                      <img 
                        src={bet.avatar} 
                        alt={bet.username} 
                        className="w-6 h-6 rounded-full mr-2" 
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center mr-2">
                        <span className="text-xs">
                          {bet.username.substring(0, 1).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span>{bet.username}</span>
                  </td>
                  <td className="text-right py-2">${bet.amount.toFixed(2)}</td>
                  <td className="text-right py-2">
                    {bet.autoCashoutAt ? `${formatMultiplier(bet.autoCashoutAt)}x` : '-'}
                  </td>
                  <td className={`text-right py-2 font-medium ${statusColor}`}>
                    {status}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

export default CrashActiveBets;