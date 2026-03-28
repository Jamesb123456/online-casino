import React from 'react';
import { FaUser } from 'react-icons/fa';

/**
 * Component to display active bets from all players in the Wheel game
 * @param {Object} props
 * @param {Array} props.bets - List of active bets
 */
const WheelActiveBets = ({ bets = [] }) => {
  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
      <div className="p-4 pb-0">
        <h3 className="text-lg font-heading font-bold text-text-primary mb-3">Active Bets</h3>
      </div>

      {bets.length === 0 ? (
        <div className="text-center text-text-muted py-4">
          No active bets
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-elevated text-text-muted text-xs font-heading uppercase tracking-wider">
                <th className="py-2 px-4 text-left">Player</th>
                <th className="py-2 px-4 text-left">Difficulty</th>
                <th className="py-2 px-4 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bets.map((bet) => (
                <tr key={bet.id} className="border-b border-border last:border-b-0">
                  <td className="py-2 px-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-bg-elevated rounded-full flex items-center justify-center overflow-hidden">
                        {bet.avatar ? (
                          <img
                            src={bet.avatar}
                            alt={bet.username}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FaUser className="text-text-muted text-xs" />
                        )}
                      </div>
                      <span className="text-text-primary text-sm font-medium">{bet.username}</span>
                    </div>
                  </td>
                  <td className="py-2 px-4 text-text-secondary capitalize">
                    {bet.difficulty || 'medium'}
                  </td>
                  <td className="py-2 px-4 text-text-secondary text-right font-medium">
                    ${bet.betAmount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default WheelActiveBets;