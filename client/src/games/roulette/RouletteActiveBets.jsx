import React from 'react';
import Card from '../../components/ui/Card';
import { FaUser } from 'react-icons/fa';

/**
 * Component to display active bets from all players in the Roulette game
 * @param {Object} props
 * @param {Array} props.bets - List of active bets
 */
const RouletteActiveBets = ({ bets = [] }) => {
  // Helper function to format bet type and value for display
  const formatBetType = (type, value) => {
    switch (type) {
      case 'STRAIGHT':
        return `Number ${value}`;
      case 'RED':
        return 'Red';
      case 'BLACK':
        return 'Black';
      case 'ODD':
        return 'Odd';
      case 'EVEN':
        return 'Even';
      case 'LOW':
        return '1-18';
      case 'HIGH':
        return '19-36';
      case 'DOZEN':
        return `Dozen ${value}`;
      case 'COLUMN':
        return `Column ${value}`;
      default:
        return `${type} ${value || ''}`;
    }
  };

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
                <th className="pb-2">Bet</th>
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
                  <td className="py-2 text-sm">
                    {formatBetType(bet.type, bet.value)}
                  </td>
                  <td className="py-2 text-sm text-right font-medium">
                    ${bet.amount.toFixed(2)}
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

export default RouletteActiveBets;