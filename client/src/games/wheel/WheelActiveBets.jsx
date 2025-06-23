import React from 'react';
import Card from '../../components/ui/Card';
import { FaUser } from 'react-icons/fa';

/**
 * Component to display active bets from all players in the Wheel game
 * @param {Object} props
 * @param {Array} props.bets - List of active bets
 */
const WheelActiveBets = ({ bets = [] }) => {
  return (
    <Card>
      <h3 className="text-lg font-bold mb-4">Active Bets</h3>
      
      {bets.length === 0 ? (
        <div className="text-center text-gray-500 py-4">
          No active bets
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm text-gray-600 border-b">
                <th className="pb-2">Player</th>
                <th className="pb-2">Difficulty</th>
                <th className="pb-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {bets.map((bet) => (
                <tr key={bet.id} className="border-b last:border-b-0">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                        {bet.avatar ? (
                          <img 
                            src={bet.avatar} 
                            alt={bet.username} 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <FaUser className="text-gray-400 text-xs" />
                        )}
                      </div>
                      <span className="text-sm font-medium">{bet.username}</span>
                    </div>
                  </td>
                  <td className="py-2 text-sm capitalize">
                    {bet.difficulty || 'medium'}
                  </td>
                  <td className="py-2 text-sm text-right font-medium">
                    ${bet.betAmount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
};

export default WheelActiveBets;