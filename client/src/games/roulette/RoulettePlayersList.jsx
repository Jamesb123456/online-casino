import React from 'react';
import { FaUser } from 'react-icons/fa';

/**
 * Component to display the list of active players in the Roulette game
 * @param {Object} props
 * @param {Array} props.players - List of active players
 */
const RoulettePlayersList = ({ players = [] }) => {
  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-heading font-bold text-text-primary">Active Players</h3>
        <span className="bg-accent-gold text-bg-base text-xs font-bold px-2 py-1 rounded-full">
          {players.length}
        </span>
      </div>

      {players.length === 0 ? (
        <div className="text-center text-text-muted py-4">
          No active players
        </div>
      ) : (
        <div className="max-h-60 overflow-y-auto">
          {players.map(player => (
            <div
              key={player.id}
              className="flex items-center gap-2 py-2 border-b border-border last:border-0"
            >
              <div className="w-8 h-8 bg-bg-elevated rounded-full flex items-center justify-center overflow-hidden">
                {player.avatar ? (
                  <img
                    src={player.avatar}
                    alt={player.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <FaUser className="text-text-muted" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-text-primary text-sm font-medium truncate">{player.username}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default RoulettePlayersList;