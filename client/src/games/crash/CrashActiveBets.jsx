import React from 'react';
import { formatMultiplier } from './crashUtils';

/**
 * Component to display all active bets in the Crash game
 */
const CrashActiveBets = ({ bets = [], currentMultiplier = 1 }) => {
  if (!bets || bets.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl overflow-hidden p-4">
        <h3 className="text-lg font-heading font-bold text-text-primary mb-2">Active Bets</h3>
        <p className="text-text-muted text-sm">No active bets</p>
      </div>
    );
  }

  // Sort bets by amount (highest first)
  const sortedBets = [...bets].sort((a, b) => b.amount - a.amount);

  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 pb-0">
        <h3 className="text-lg font-heading font-bold text-text-primary mb-2">Active Bets ({bets.length})</h3>
      </div>
      <div className="max-h-80 overflow-y-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-elevated text-text-muted text-xs font-heading uppercase tracking-wider">
              <th className="text-left py-2 px-4">Player</th>
              <th className="text-right py-2 px-4">Bet</th>
              <th className="text-right py-2 px-4">Auto Cash</th>
              <th className="text-right py-2 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedBets.map((bet) => {
              // Determine bet status
              let status = 'Active';
              let statusColor = 'text-accent-gold';

              if (bet.cashedOut) {
                status = `${formatMultiplier(bet.cashedOutAt)}x`;
                statusColor = 'text-status-success';
              }

              return (
                <tr key={bet.userId} className="border-b border-border">
                  <td className="py-2 px-4 flex items-center">
                    {bet.avatar ? (
                      <img
                        src={bet.avatar}
                        alt={bet.username}
                        className="w-6 h-6 rounded-full mr-2"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-bg-elevated flex items-center justify-center mr-2">
                        <span className="text-xs text-text-secondary">
                          {bet.username.substring(0, 1).toUpperCase()}
                        </span>
                      </div>
                    )}
                    <span className="text-text-primary">{bet.username}</span>
                  </td>
                  <td className="text-right py-2 px-4 text-text-secondary">${bet.amount.toFixed(2)}</td>
                  <td className="text-right py-2 px-4 text-text-secondary">
                    {bet.autoCashoutAt ? `${formatMultiplier(bet.autoCashoutAt)}x` : '-'}
                  </td>
                  <td className={`text-right py-2 px-4 font-heading font-bold ${statusColor}`}>
                    {status}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CrashActiveBets;