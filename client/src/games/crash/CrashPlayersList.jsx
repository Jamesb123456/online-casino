import React from 'react';
import Card from '../../components/ui/Card';

/**
 * Component to display active players in the Crash game
 */
const CrashPlayersList = ({ players = [] }) => {
  if (!players || players.length === 0) {
    return (
      <Card className="p-4">
        <h3 className="text-lg font-bold mb-2">Players in Room</h3>
        <p className="text-gray-400 text-sm">No active players</p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <h3 className="text-lg font-bold mb-2">Players in Room ({players.length})</h3>
      <div className="max-h-60 overflow-y-auto">
        <ul className="divide-y divide-gray-700">
          {players.map((player) => (
            <li key={player.id} className="py-2 flex items-center">
              {player.avatar ? (
                <img 
                  src={player.avatar} 
                  alt={player.username} 
                  className="w-8 h-8 rounded-full mr-2" 
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center mr-2">
                  <span className="text-xs font-bold">
                    {player.username.substring(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-sm">{player.username}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
};

export default CrashPlayersList;