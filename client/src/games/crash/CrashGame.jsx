import React, { useState, useEffect, useRef, useCallback } from 'react';
import { formatMultiplier, getMultiplierColor } from './crashUtils';
import CrashBettingPanel from './CrashBettingPanel';
import CrashHistory from './CrashHistory';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import crashSocketService from '../../services/socket/crashSocketService';

// Destructure the methods from the service
const {
  joinCrashGame,
  leaveCrashGame,
  onGameStateChange,
  onMultiplierUpdate,
  onGameStarting,
  onGameStarted,
  onGameCrashed,
  placeBet,
  cashOut
} = crashSocketService;

// For development, toggle between mock and real socket
// In production, this would be determined by environment variables
const USE_MOCK_SOCKET = true;

// Mock socket implementation for development
const useMockSocket = () => {
  const [gameState, setGameState] = useState({
    status: 'waiting', // waiting, running, crashed
    crashPoint: 0,
    currentMultiplier: 1.00,
    countdown: 5,
    players: [],
  });

  const [history, setHistory] = useState([
    { id: 1, crashPoint: 1.98, timestamp: new Date().getTime() - 60000 },
    { id: 2, crashPoint: 3.45, timestamp: new Date().getTime() - 120000 },
    { id: 3, crashPoint: 1.23, timestamp: new Date().getTime() - 180000 },
    { id: 4, crashPoint: 7.85, timestamp: new Date().getTime() - 240000 },
    { id: 5, crashPoint: 1.15, timestamp: new Date().getTime() - 300000 },
  ]);

  // Mock game cycle
  useEffect(() => {
    let intervalId;
    let startTime;
    let animationFrameId;

    const startGame = () => {
      // Generate random crash point between 1.00 and 10.00
      const crashPoint = 1 + Math.random() * 9;
      console.log('Game started with crash point:', crashPoint.toFixed(2));
      
      setGameState(prev => ({
        ...prev,
        status: 'running',
        crashPoint,
        currentMultiplier: 1.00
      }));

      startTime = Date.now();
      
      // Animation function to update multiplier
      const updateMultiplier = () => {
        const elapsedTime = Date.now() - startTime;
        
        // Calculate new multiplier (exponential growth)
        const newMultiplier = 1 + (elapsedTime / 1000);
        
        if (newMultiplier < crashPoint) {
          setGameState(prev => ({
            ...prev,
            currentMultiplier: parseFloat(newMultiplier.toFixed(2))
          }));
          animationFrameId = requestAnimationFrame(updateMultiplier);
        } else {
          // Game crashed
          setGameState(prev => ({
            ...prev,
            status: 'crashed',
            currentMultiplier: crashPoint
          }));
          
          // Add to history
          setHistory(prev => [
            { 
              id: Date.now(), 
              crashPoint: parseFloat(crashPoint.toFixed(2)), 
              timestamp: Date.now() 
            },
            ...prev.slice(0, 9) // Keep last 10 items
          ]);
          
          // Wait 3 seconds then start countdown for next game
          setTimeout(startCountdown, 3000);
        }
      };
      
      animationFrameId = requestAnimationFrame(updateMultiplier);
    };

    const startCountdown = () => {
      setGameState(prev => ({
        ...prev,
        status: 'waiting',
        countdown: 5
      }));
      
      intervalId = setInterval(() => {
        setGameState(prev => {
          if (prev.countdown <= 1) {
            clearInterval(intervalId);
            startGame();
            return {...prev, countdown: 0};
          }
          return {...prev, countdown: prev.countdown - 1};
        });
      }, 1000);
    };

    // Start initial countdown
    startCountdown();

    return () => {
      clearInterval(intervalId);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const mockPlaceBet = useCallback((betData) => {
    console.log('Mock place bet:', betData);
    return Promise.resolve({ success: true, betId: Date.now() });
  }, []);

  const mockCashOut = useCallback((data) => {
    console.log('Mock cash out:', data);
    return Promise.resolve({ 
      success: true, 
      multiplier: gameState.currentMultiplier,
      winnings: data.amount * gameState.currentMultiplier
    });
  }, [gameState.currentMultiplier]);

  return { 
    gameState, 
    history,
    placeBet: mockPlaceBet,
    cashOut: mockCashOut
  };
};

// Real socket implementation
const useRealSocket = () => {
  const [gameState, setGameState] = useState({
    status: 'connecting', // connecting, waiting, running, crashed
    crashPoint: 0,
    currentMultiplier: 1.00,
    countdown: 0,
    players: [],
  });

  const [history, setHistory] = useState([]);

  // Initialize socket and subscribe to events
  useEffect(() => {
    // Initialize Socket.IO connection
    initializeSocket();
    
    // Join crash game room
    joinCrashGame();

    // Subscribe to game state updates
    const unsubGameState = onGameStateChange((state) => {
      console.log('Game state update:', state);
      setGameState(state);
      
      // If we're getting initial state with history
      if (state.history && state.history.length > 0) {
        setHistory(state.history);
      }
    });

    // Subscribe to multiplier updates
    const unsubMultiplier = onMultiplierUpdate((data) => {
      setGameState(prev => ({
        ...prev,
        currentMultiplier: data.multiplier
      }));
    });

    // Subscribe to game starting event
    const unsubGameStarting = onGameStarting((data) => {
      setGameState(prev => ({
        ...prev,
        status: 'waiting',
        countdown: data.countdown || 5
      }));
    });

    // Subscribe to game started event
    const unsubGameStarted = onGameStarted((data) => {
      setGameState(prev => ({
        ...prev,
        status: 'running',
        currentMultiplier: 1.00,
        players: data.players || []
      }));
    });

    // Subscribe to game crashed event
    const unsubGameCrashed = onGameCrashed((data) => {
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

    // Cleanup function
    return () => {
      // Leave crash game room
      leaveCrashGame();
      
      // Unsubscribe from all events
      unsubGameState();
      unsubMultiplier();
      unsubGameStarting();
      unsubGameStarted();
      unsubGameCrashed();
    };
  }, []);

  // Handle place bet with socket
  const realPlaceBet = useCallback((betData) => {
    return new Promise((resolve, reject) => {
      socketPlaceBet(betData, (response) => {
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
      socketCashOut(data, (response) => {
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
    placeBet: realPlaceBet,
    cashOut: realCashOut
  };
};

const CrashGame = () => {
  // Use either mock or real socket based on flag
  const { gameState, history, placeBet: socketPlaceBet, cashOut: socketCashOut } = 
    USE_MOCK_SOCKET ? useMockSocket() : useRealSocket();
  
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
        // TODO: Show error toast/notification
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
        // TODO: Show error toast/notification
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
          <Card className="p-0 overflow-hidden">
            <canvas
              ref={canvasRef}
              width={800}
              height={400}
              className="w-full bg-gray-900"
            ></canvas>
            
            {/* Game status overlay */}
            <div className="absolute top-4 left-4 flex gap-2">
              <span className={`
                w-3 h-3 rounded-full ${
                  gameState.status === 'connecting' ? 'bg-blue-400 animate-pulse' :
                  gameState.status === 'waiting' ? 'bg-yellow-400' :
                  gameState.status === 'running' ? 'bg-green-500 animate-pulse' : 
                  'bg-red-500'
                }
              `}></span>
              <span className="text-xs font-bold text-white">
                {gameState.status === 'connecting' ? 'CONNECTING' :
                 gameState.status === 'waiting' ? 'STARTING' :
                 gameState.status === 'running' ? 'LIVE' : 
                 'CRASHED'}
              </span>
            </div>
            
            {/* Game result popup */}
            {gameResult && (
              <div className={`
                absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2
                px-6 py-3 rounded-lg font-bold text-white text-2xl
                ${gameResult.type === 'win' ? 'bg-green-600' : 'bg-red-600'}
              `}>
                {gameResult.type === 'win' 
                  ? `+${gameResult.profit.toFixed(2)} @ ${formatMultiplier(gameResult.multiplier)}` 
                  : `Crashed @ ${formatMultiplier(gameState.crashPoint)}`
                }
              </div>
            )}
          </Card>
        </div>
        
        <CrashHistory history={history} />
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