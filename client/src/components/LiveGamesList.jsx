import React, { useState, useEffect } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { Link } from 'react-router-dom';

// Game Icon Component
const GameIcon = ({ game, size = "sm" }) => {
  const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6"
  };
  
  // Game-specific icons
  const icons = {
    crash: (
      <svg viewBox="0 0 24 24" className={`${sizeClasses[size]} text-[#EF4444]`} fill="currentColor">
        <path d="M16,6L6,16H16V6M16,4.8V17.2C16,17.6 15.6,18 15.2,18H6A2,2 0 0,1 4,16V15.2L15.2,4H16A0.8,0.8 0 0,1 16,4.8M19,19V7H21V19A2,2 0 0,1 19,21H7V19H19Z" />
      </svg>
    ),
    roulette: (
      <svg viewBox="0 0 24 24" className={`${sizeClasses[size]} text-[#10B981]`} fill="currentColor">
        <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16" />
      </svg>
    ),
    blackjack: (
      <svg viewBox="0 0 24 24" className={`${sizeClasses[size]} text-[#3B82F6]`} fill="currentColor">
        <path d="M17,2H7A2,2 0 0,0 5,4V20A2,2 0 0,0 7,22H17A2,2 0 0,0 19,20V4A2,2 0 0,0 17,2M17,20H7V4H17V20M15,6H9V8H15V6M15,10H9V12H15V10M15,14H9V16H15V14Z" />
      </svg>
    ),
    plinko: (
      <svg viewBox="0 0 24 24" className={`${sizeClasses[size]} text-[#8B5CF6]`} fill="currentColor">
        <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4M12,6A6,6 0 0,0 6,12A6,6 0 0,0 12,18A6,6 0 0,0 18,12A6,6 0 0,0 12,6M12,8A4,4 0 0,1 16,12A4,4 0 0,1 12,16A4,4 0 0,1 8,12A4,4 0 0,1 12,8Z" />
      </svg>
    ),
    wheel: (
      <svg viewBox="0 0 24 24" className={`${sizeClasses[size]} text-[#F59E0B]`} fill="currentColor">
        <path d="M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M12,10.5A1.5,1.5 0 0,1 13.5,12A1.5,1.5 0 0,1 12,13.5A1.5,1.5 0 0,1 10.5,12A1.5,1.5 0 0,1 12,10.5M7.5,10.5A1.5,1.5 0 0,1 9,12A1.5,1.5 0 0,1 7.5,13.5A1.5,1.5 0 0,1 6,12A1.5,1.5 0 0,1 7.5,10.5M16.5,10.5A1.5,1.5 0 0,1 18,12A1.5,1.5 0 0,1 16.5,13.5A1.5,1.5 0 0,1 15,12A1.5,1.5 0 0,1 16.5,10.5Z" />
      </svg>
    ),
  };
  
  return icons[game] || (
    <svg viewBox="0 0 24 24" className={`${sizeClasses[size]} text-gray-400`} fill="currentColor">
      <path d="M21,16.5C21,16.88 20.79,17.21 20.47,17.38L12.57,21.82C12.41,21.94 12.21,22 12,22C11.79,22 11.59,21.94 11.43,21.82L3.53,17.38C3.21,17.21 3,16.88 3,16.5V7.5C3,7.12 3.21,6.79 3.53,6.62L11.43,2.18C11.59,2.06 11.79,2 12,2C12.21,2 12.41,2.06 12.57,2.18L20.47,6.62C20.79,6.79 21,7.12 21,7.5V16.5M12,4.15L5,8.09V15.91L12,19.85L19,15.91V8.09L12,4.15Z" />
    </svg>
  );
};

// Game Filter Button
const GameFilterButton = ({ game, isActive, onClick }) => {
  const gameNames = {
    all: 'All',
    crash: 'Crash',
    roulette: 'Roulette',
    blackjack: 'Blackjack',
    plinko: 'Plinko',
    wheel: 'Wheel',
  };

  return (
    <button
      onClick={() => onClick(game)}
      className={`flex items-center justify-center rounded-full p-1 ${
        isActive 
          ? 'bg-[#0c7fe9] text-white' 
          : 'bg-[#213749] text-gray-400 hover:bg-[#213749]/80'
      } transition-colors duration-200`}
    >
      <div className="w-6 h-6 flex items-center justify-center">
        <GameIcon game={game} size="sm" />
      </div>
    </button>
  );
};

// Live Game List Item
const LiveGameItem = ({ game }) => {
  const [expanded, setExpanded] = useState(false);

  // Generate random multipliers for crash game
  const generateCrashMultipliers = () => {
    const results = [];
    for (let i = 0; i < 5; i++) {
      const multiplier = (Math.random() * 5 + 1).toFixed(2);
      results.push(multiplier + 'x');
    }
    return results;
  };

  // Get appropriate data based on game type
  const getGameData = () => {
    switch (game.type) {
      case 'crash':
        return {
          title: `Crash Game #${game.id}`,
          status: 'Betting Phase',
          results: generateCrashMultipliers(),
          players: Math.floor(Math.random() * 15) + 5,
        };
      case 'roulette':
        return {
          title: `Roulette Table #${game.id}`,
          status: 'Spinning Wheel',
          results: ['32', '15', '19', '4', '21'],
          players: Math.floor(Math.random() * 10) + 8,
        };
      case 'blackjack':
        return {
          title: `Blackjack Table #${game.id}`,
          status: 'Waiting for Players',
          results: ['Player Won', 'Dealer Won', 'Push', 'Player Won', 'Player Won'],
          players: Math.floor(Math.random() * 4) + 1,
        };
      default:
        return {
          title: `${game.type.charAt(0).toUpperCase() + game.type.slice(1)} Game #${game.id}`,
          status: 'In Progress',
          results: ['Win', 'Loss', 'Win', 'Win', 'Loss'],
          players: Math.floor(Math.random() * 10) + 2,
        };
    }
  };

  const gameData = getGameData();

  return (
    <div className="bg-bg-card border border-bg-elevated rounded-md mb-2 overflow-hidden">
      {/* Header row */}
      <div 
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-bg-elevated/50"
      >
        <div className="flex items-center space-x-3">
          <GameIcon game={game.type} size="md" />
          <div>
            <div className="font-medium text-white">{gameData.title}</div>
            <div className="text-sm text-gray-400">{gameData.status}</div>
          </div>
        </div>
        
        <div className="flex items-center space-x-6">
          {/* Players count */}
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1 text-gray-400" viewBox="0 0 20 20" fill="currentColor" style={{maxWidth: '12px', maxHeight: '12px'}}>
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
            <span className="text-gray-300 text-sm">{gameData.players}</span>
          </div>
          
          {/* Recent results bubbles */}
          <div className="hidden md:flex items-center space-x-1">
            {gameData.results.slice(0, 3).map((result, idx) => (
              <div key={idx} className="w-6 h-6 rounded-full bg-bg-elevated flex items-center justify-center text-xs font-medium text-white">
                {result.toString().substring(0, 1)}
              </div>
            ))}
          </div>
          
          {/* Join button */}
          <div>
            <Link 
              to={`/games/${game.type}`}
              className="inline-flex px-3 py-1 rounded bg-primary hover:bg-primary-dark text-white text-sm font-medium transition-colors"
            >
              Play
            </Link>
          </div>
          
          {/* Expand button */}
          <button className="text-gray-400">
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              className={`h-3 w-3 transform transition-transform ${expanded ? 'rotate-180' : ''}`} 
              viewBox="0 0 20 20" 
              fill="currentColor"
              style={{maxWidth: '12px', maxHeight: '12px'}}
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Expanded content */}
      {expanded && (
        <div className="p-4 border-t border-bg-elevated bg-bg-subtle">
          <div className="flex flex-col space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-400 mb-2">Recent Results</h4>
              <div className="flex space-x-2 overflow-x-auto">
                {gameData.results.map((result, idx) => (
                  <div 
                    key={idx} 
                    className="px-2 py-1 rounded bg-[#213749] text-xs font-medium text-white"
                  >
                    {result}
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">
                <span className="font-medium text-white">{gameData.players}</span> players currently active
              </div>
              
              <Link 
                to={`/games/${game.type}`}
                className="inline-flex items-center px-4 py-2 rounded bg-[#0c7fe9] hover:bg-[#0967c5] text-white text-sm font-medium transition-colors"
              >
                Join Game
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const LiveGamesList = () => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [liveGames, setLiveGames] = useState([]);
  const { socket } = useSocket();
  
  useEffect(() => {
    if (!socket) return;
    
    // Request current live games when component mounts
    socket.emit('get_live_games');
    
    // Listen for live games updates
    const handleLiveGames = (games) => {
      console.log('Received live games data:', games);
      setLiveGames(games);
    };
    
    socket.on('live_games', handleLiveGames);
    
    // Set up interval to refresh data
    const refreshInterval = setInterval(() => {
      socket.emit('get_live_games');
    }, 15000); // Refresh every 15 seconds
    
    return () => {
      socket.off('live_games', handleLiveGames);
      clearInterval(refreshInterval);
    };
  }, [socket]);
  
  // Filter games based on active filter
  const filteredGames = activeFilter === 'all' 
    ? liveGames 
    : liveGames.filter(game => game.type === activeFilter);
  
  console.log("LiveGamesList rendering", filteredGames, "Props valid?", Array.isArray(filteredGames));
  
  // Debug component visibility with error handling
  if (!Array.isArray(filteredGames)) {
    return (
      <div style={{
        padding: '20px',
        background: 'purple',
        color: 'white',
        border: '5px solid yellow',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        LiveGamesList error - Props debugging: Invalid filteredGames format
      </div>
    );
  }
  
  return (
    <div className="mb-6" data-testid="live-games-list" style={{
      zIndex: 50, 
      position: 'relative', 
      border: '4px solid orange', 
      minHeight: '150px', 
      background: '#192c3d',
      padding: '20px',
      display: 'block', 
      overflow: 'visible',
      width: '100%'
    }}>
      <div style={{padding: '10px', background: '#0c7fe9', color: 'white', textAlign: 'center', borderRadius: '8px', margin: '20px 0'}}>
        DEBUGGING: LiveGamesList component is rendering
      </div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-[#0c7fe9]" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
          <h2 className="text-white text-xl font-medium">Live Events</h2>
        </div>
        
        <div>
          <button className="text-[#0c7fe9] font-medium text-sm hover:underline flex items-center">
            Winner 
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Game filters */}
      <div className="flex space-x-2 mb-4 overflow-x-auto pb-2">
        <GameFilterButton 
          game="all" 
          isActive={activeFilter === 'all'} 
          onClick={setActiveFilter} 
        />
        {['crash', 'roulette', 'blackjack', 'plinko', 'wheel'].map(game => (
          <GameFilterButton 
            key={game}
            game={game} 
            isActive={activeFilter === game} 
            onClick={setActiveFilter} 
          />
        ))}
      </div>
      
      {/* Live games list */}
      <div>
        {filteredGames.length > 0 ? (
          filteredGames.map(game => (
            <LiveGameItem key={game.id} game={game} />
          ))
        ) : (
          <div className="bg-[#192c3d] border border-[#213749] rounded-md p-8 text-center">
            <p className="text-gray-400">No live games found for this filter.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LiveGamesList;