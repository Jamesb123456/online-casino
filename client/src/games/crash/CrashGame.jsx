import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { formatMultiplier, getMultiplierColor } from './crashUtils';
import CrashBettingPanel from './CrashBettingPanel';
import CrashHistory from './CrashHistory';
import CrashPlayersList from './CrashPlayersList';
import CrashActiveBets from './CrashActiveBets';
import crashSocketService from '../../services/socket/crashSocketService';
import { AuthContext } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useNavigate } from 'react-router-dom';

// Don't destructure socket methods as they will lose their 'this' context
// Access methods directly through the service object instead
const crashSocket = crashSocketService;

// Socket hook for real-time game state
const useCrashSocket = (authUser) => {
  const [gameState, setGameState] = useState({
    status: 'connecting', // connecting, waiting, running, crashed
    crashPoint: 0,
    currentMultiplier: 1.00,
    countdown: 0,
    players: [],
  });

  const [history, setHistory] = useState([]);
  const [activePlayers, setActivePlayers] = useState([]);
  const [activeBets, setActiveBets] = useState([]);

  // Initialize socket and subscribe to events
  useEffect(() => {
    // Initialize Socket.IO connection with authenticated user info
    const userInfo = {
      userId: authUser?.id || 'guest',
      username: authUser?.username || 'Guest',
      avatar: authUser?.avatar || null
    };

    // Initialize Socket.IO connection
    crashSocketService.setUser(userInfo);
    crashSocketService.connect(userInfo);
    
    // Join crash game room
    crashSocket.joinCrashGame();

    // Subscribe to game state updates
    const unsubGameState = crashSocket.onGameStateChange((state) => {
      setGameState(state);
      
      // If we're getting initial state with history
      if (state.history && state.history.length > 0) {
        setHistory(state.history);
      }
    });

    // Subscribe to multiplier updates
    const unsubMultiplier = crashSocket.onMultiplierUpdate((data) => {
      setGameState(prev => ({
        ...prev,
        currentMultiplier: data.multiplier
      }));
    });

    // Subscribe to game starting event
    const unsubGameStarting = crashSocket.onGameStarting((data) => {
      setGameState(prev => ({
        ...prev,
        status: 'waiting',
        countdown: data.countdown || 5
      }));
      
      // Clear active bets for new game
      setActiveBets([]);
    });

    // Subscribe to game started event
    const unsubGameStarted = crashSocket.onGameStarted((data) => {
      setGameState(prev => ({
        ...prev,
        status: 'running',
        currentMultiplier: 1.00
      }));
    });

    // Subscribe to game crashed event
    const unsubGameCrashed = crashSocket.onGameCrashed((data) => {
      setGameState(prev => ({
        ...prev,
        status: 'crashed',
        crashPoint: data.crashPoint,
        currentMultiplier: data.crashPoint
      }));
      
      // Update game history
      if (data.crashPoint) {
        setHistory(prev => [
          { 
            id: data.gameId || Date.now(), 
            crashPoint: data.crashPoint, 
            timestamp: data.timestamp || Date.now() 
          },
          ...prev.slice(0, 19) // Keep last 20 items
        ]);
      }
    });
    
    // Subscribe to active players updates
    const unsubActivePlayers = crashSocket.onActivePlayers((players) => {
      setActivePlayers(players);
    });
    
    // Subscribe to player joined events
    const unsubPlayerJoined = crashSocket.onPlayerJoined((player) => {
      setActivePlayers(prev => [...prev, player]);
    });
    
    // Subscribe to player left events
    const unsubPlayerLeft = crashSocket.onPlayerLeft((player) => {
      setActivePlayers(prev => prev.filter(p => p.id !== player.id));
    });
    
    // Subscribe to current bets updates
    const unsubCurrentBets = crashSocket.onCurrentBets((bets) => {
      setActiveBets(bets);
    });
    
    // Subscribe to player bet events
    const unsubPlayerBet = crashSocket.onPlayerBet((bet) => {
      setActiveBets(prev => {
        // Check if this player already has a bet
        const existingBetIndex = prev.findIndex(b => b.userId === bet.userId);
        if (existingBetIndex >= 0) {
          // Replace existing bet
          const newBets = [...prev];
          newBets[existingBetIndex] = bet;
          return newBets;
        } else {
          // Add new bet
          return [...prev, bet];
        }
      });
    });
    
    // Subscribe to player cashout events
    const unsubPlayerCashout = crashSocket.onPlayerCashout((cashout) => {
      setActiveBets(prev => {
        return prev.map(bet => {
          if (bet.userId === cashout.userId) {
            return {
              ...bet,
              cashedOut: true,
              cashedOutAt: cashout.multiplier,
              profit: cashout.profit
            };
          }
          return bet;
        });
      });
    });

    // Cleanup function
    return () => {
      // Leave crash game room
      crashSocket.leaveCrashGame();
      
      // Unsubscribe from all events
      unsubGameState();
      unsubMultiplier();
      unsubGameStarting();
      unsubGameStarted();
      unsubGameCrashed();
      unsubActivePlayers();
      unsubPlayerJoined();
      unsubPlayerLeft();
      unsubCurrentBets();
      unsubPlayerBet();
      unsubPlayerCashout();
    };
  }, [authUser]);

  // Handle place bet with socket
  const realPlaceBet = useCallback((betData) => {
    return new Promise((resolve, reject) => {
      crashSocket.placeBet(betData, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.message || 'Failed to place bet'));
        }
      });
    });
  }, []);

  // Handle cash out with socket
  const realCashOut = useCallback((data) => {
    return new Promise((resolve, reject) => {
      crashSocket.cashOut(data, (response) => {
        if (response.success) {
          resolve(response);
        } else {
          reject(new Error(response.message || 'Failed to cash out'));
        }
      });
    });
  }, []);

  return { 
    gameState, 
    history,
    activePlayers,
    activeBets,
    placeBet: realPlaceBet,
    cashOut: realCashOut
  };
};

const CrashGame = () => {
  const { user, isAuthenticated, loading } = useContext(AuthContext);
  const toast = useToast();
  const navigate = useNavigate();
  const [connectionError, setConnectionError] = useState(null);

  // Check authentication status after auth state has loaded
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/login', { state: { from: '/games/crash', message: 'You must be logged in to play games.' } });
    }
  }, [isAuthenticated, loading, navigate]);
  
  // Use real socket implementation
  const socketData = useCrashSocket(user);
  const gameState = socketData.gameState;
  const history = socketData.history;
  const activePlayers = socketData.activePlayers || [];
  const activeBets = socketData.activeBets || [];
  const socketPlaceBet = (data, callback) => crashSocket.placeBet(data, callback);
  const socketCashOut = (data, callback) => crashSocket.cashOut(data, callback);
  
  // Listen for authentication errors
  useEffect(() => {
    const handleConnectError = (error) => {
      console.error('Socket connection error:', error);
      if (typeof error === 'string' && error.includes('Authentication')) {
        setConnectionError('Authentication error. Please log in again.');
        // Redirect to login after a short delay
        setTimeout(() => navigate('/login'), 2000);
      }
    };
    
    // Subscribe to socket connection errors
    crashSocket.onConnectError(handleConnectError);
    
    // Cleanup
    return () => crashSocket.offConnectError(handleConnectError);
  }, [navigate]);
  
  const [bet, setBet] = useState({
    amount: 10,
    autoCashout: 2.00,
  });
  const [activeBet, setActiveBet] = useState(null);
  const [gameResult, setGameResult] = useState(null);
  const canvasRef = useRef(null);

  // Handle placing a bet
  const placeBet = async () => {
    if (gameState.status === 'waiting' && !activeBet) {
      try {
        setActiveBet({
          ...bet,
          id: Date.now(),
          status: 'placing',
        });
        
        const result = await socketPlaceBet({
          amount: bet.amount,
          autoCashout: bet.autoCashout
        });
        
        setActiveBet(prev => ({
          ...prev,
          id: result.betId || prev.id,
          status: 'placed',
        }));
        
        setGameResult(null);
      } catch (error) {
        console.error('Error placing bet:', error);
        setActiveBet(null);
        toast.error(error.message || 'Failed to place bet. Please try again.');
      }
    }
  };

  // Handle manual cashout
  const cashout = async () => {
    if (activeBet && activeBet.status === 'placed' && gameState.status === 'running') {
      try {
        setActiveBet(prev => ({
          ...prev,
          status: 'cashing_out',
        }));
        
        const result = await socketCashOut({
          betId: activeBet.id,
          amount: bet.amount
        });
        
        const winnings = result.winnings || (bet.amount * gameState.currentMultiplier);
        const cashoutMultiplier = result.multiplier || gameState.currentMultiplier;
        
        setActiveBet(prev => ({
          ...prev,
          status: 'cashed_out',
          cashedOutAt: cashoutMultiplier,
          winnings: winnings,
        }));
        
        setGameResult({
          type: 'win',
          multiplier: cashoutMultiplier,
          profit: winnings - bet.amount,
        });
      } catch (error) {
        console.error('Error cashing out:', error);
        // Reset back to placed status if cashout fails
        setActiveBet(prev => ({
          ...prev,
          status: 'placed',
        }));
        toast.error(error.message || 'Failed to cash out. Please try again.');
      }
    }
  };

  // Handle auto cashout
  useEffect(() => {
    if (
      activeBet && 
      activeBet.status === 'placed' &&
      gameState.status === 'running' &&
      gameState.currentMultiplier >= bet.autoCashout
    ) {
      cashout();
    }
  }, [gameState.currentMultiplier, bet.autoCashout, activeBet]);

  // Handle crash
  useEffect(() => {
    if (
      activeBet && 
      activeBet.status === 'placed' && 
      gameState.status === 'crashed'
    ) {
      setActiveBet({
        ...activeBet,
        status: 'lost',
      });
      
      setGameResult({
        type: 'loss',
        crashPoint: gameState.crashPoint,
        lost: bet.amount,
      });
    }
  }, [gameState.status, activeBet]);

  // Draw crash graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 20;
    const graphHeight = height - padding * 2;
    const graphWidth = width - padding * 2;

    ctx.clearRect(0, 0, width, height);

    // Draw background
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, width, height);

    // Only draw graph line if game is running or crashed
    if (gameState.status === 'running' || gameState.status === 'crashed') {
      // Draw axes
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, height - padding);
      ctx.lineTo(width - padding, height - padding); // x-axis
      ctx.stroke();

      // Calculate points for exponential curve
      const maxMultiplier = Math.max(10, gameState.currentMultiplier);
      const points = [];
      
      for (let x = 0; x < graphWidth; x++) {
        const progress = x / graphWidth;
        const multiplier = 1 + (gameState.currentMultiplier - 1) * progress;
        const y = height - padding - (graphHeight * (multiplier - 1) / (maxMultiplier - 1));
        points.push({ x: x + padding, y });
      }

      // Draw curve
      ctx.strokeStyle = getMultiplierColor(gameState.currentMultiplier);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(padding, height - padding);
      
      points.forEach(point => {
        ctx.lineTo(point.x, point.y);
      });
      
      ctx.stroke();

      // Draw current multiplier
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        formatMultiplier(gameState.currentMultiplier), 
        width / 2, 
        height / 2
      );
    } else if (gameState.status === 'waiting') {
      // Draw waiting text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        `Next round in ${gameState.countdown}s`, 
        width / 2, 
        height / 2
      );
    } else {
      // Draw connecting text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(
        'Connecting to game server...', 
        width / 2, 
        height / 2
      );
    }
  }, [gameState]);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-8/12 space-y-4">
        <div className="relative">
          <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
            <canvas
              ref={canvasRef}
              width={800}
              height={400}
              role="img"
              aria-label="Crash game graph showing the multiplier curve"
              className="w-full bg-bg-base rounded-lg overflow-hidden"
            ></canvas>
            
            {/* Game status overlay */}
            <div className="absolute top-4 left-4 flex items-center gap-2">
              <span className={`
                w-2 h-2 rounded-full ${
                  gameState.status === 'connecting' ? 'bg-status-info' :
                  gameState.status === 'waiting' ? 'bg-accent-gold' :
                  gameState.status === 'running' ? 'bg-status-success' :
                  'bg-status-error'
                }
              `}></span>
              <span className="text-xs font-heading font-bold text-text-primary">
                {gameState.status === 'connecting' ? 'CONNECTING' :
                 gameState.status === 'waiting' ? 'STARTING' :
                 gameState.status === 'running' ? 'LIVE' :
                 'CRASHED'}
              </span>
            </div>
            
            {/* Game result popup */}
            {gameResult && (
              <div role="alert" className={`
                absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2
                rounded-xl p-6 shadow-lg backdrop-blur-xl
                ${gameResult.type === 'win'
                  ? 'bg-bg-card/95 border border-status-success/30'
                  : 'bg-bg-card/95 border border-status-error/30'}
              `}>
                <div className={`text-3xl font-heading font-bold ${
                  gameResult.type === 'win' ? 'text-status-success' : 'text-status-error'
                }`}>
                  {gameResult.type === 'win'
                    ? `+${gameResult.profit.toFixed(2)} @ ${formatMultiplier(gameResult.multiplier)}`
                    : `Crashed @ ${formatMultiplier(gameState.crashPoint)}`
                  }
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CrashHistory history={history} />
          <CrashPlayersList players={activePlayers} />
        </div>
        
        {/* Active bets from all players */}
        <CrashActiveBets 
          bets={activeBets} 
          currentMultiplier={gameState.currentMultiplier} 
        />
      </div>
      
      <div className="lg:w-4/12">
        <CrashBettingPanel
          bet={bet}
          setBet={setBet}
          activeBet={activeBet}
          canBet={gameState.status === 'waiting' && !activeBet}
          canCashout={activeBet?.status === 'placed' && gameState.status === 'running'}
          onPlaceBet={placeBet}
          onCashout={cashout}
          currentMultiplier={gameState.currentMultiplier}
          gameStatus={gameState.status}
        />
      </div>
    </div>
  );
};

export default CrashGame;