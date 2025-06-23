import React from 'react';
import Card from '../../components/ui/Card';
import { FaUser } from 'react-icons/fa';

/**
 * Component to display the list of active players in the Roulette game
 * @param {Object} props
 * @param {Array} props.players - List of active players
 */
const RoulettePlayersList = ({ players = [] }) => {
  return (
    <Card className="h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">Active Players</h3>
        <span className="bg-primary text-white text-xs px-2 py-1 rounded-full">
          {players.length}
        </span>
      </div>
      
      {players.length === 0 ? (
        <div className="text-center text-gray-500 py-4">
          No active players
        </div>
      ) : (
        <div className="max-h-60 overflow-y-auto">
          {players.map(player => (
            <div 
              key={player.id} 
              className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded-md"
            >
              <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                {player.avatar ? (
                  <img 
                    src={player.avatar} 
                    alt={player.username} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FaUser className="text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium truncate">{player.username}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export default RoulettePlayersList;