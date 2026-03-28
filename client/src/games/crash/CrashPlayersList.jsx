import React from 'react';

/**
 * Component to display active players in the Crash game
 */
const CrashPlayersList = ({ players = [] }) => {
  if (!players || players.length === 0) {
    return (
      <div className="bg-bg-card border border-border rounded-xl p-4">
        <h3 className="text-lg font-heading font-bold text-text-primary mb-2">Players in Room</h3>
        <p className="text-text-muted text-sm">No active players</p>
      </div>
    );
  }

  return (
    <div className="bg-bg-card border border-border rounded-xl p-4">
      <h3 className="text-lg font-heading font-bold text-text-primary mb-2">Players in Room ({players.length})</h3>
      <div className="max-h-60 overflow-y-auto">
        <ul>
          {players.map((player) => (
            <li key={player.id} className="flex items-center gap-2 py-2 border-b border-border last:border-0">
              {player.avatar ? (
                <img
                  src={player.avatar}
                  alt={player.username}
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-bg-elevated flex items-center justify-center">
                  <span className="text-xs font-bold text-text-secondary">
                    {player.username.substring(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-text-primary text-sm">{player.username}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default CrashPlayersList;