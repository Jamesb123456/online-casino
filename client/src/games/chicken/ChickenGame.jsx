import React, { useState, useEffect, useCallback } from 'react';
import ChickenBoard from './ChickenBoard';
import ChickenBettingPanel from './ChickenBettingPanel';
import { generateMockHistory, generateGameResult, calculateProfit, GAME_CONSTANTS } from './chickenUtils';
import chickenSocketService from '../../services/socket/chickenSocketService';

const ChickenGame = () => {
  // Game state
  const [balance, setBalance] = useState(1000);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [currentBet, setCurrentBet] = useState(null);
  const [autoCashOut, setAutoCashOut] = useState(null);
  const [hasCrashed, setHasCrashed] = useState(false);
  const [crashPoint, setCrashPoint] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [lastResult, setLastResult] = useState(null);
  const [cashOutMultiplier, setCashOutMultiplier] = useState(null);
  const [useMockData, setUseMockData] = useState(true); // Toggle for mock/real data
  const [isConnected, setIsConnected] = useState(false);
  const [currentDifficulty, setCurrentDifficulty] = useState('medium');

  // Initialize game with mock history
  useEffect(() => {
    // Generate initial mock history
    const mockHistory = generateMockHistory(10);
    setGameHistory(mockHistory);

    // If using real data, connect to socket
    if (!useMockData) {
      chickenSocketService.connect();
      setIsConnected(chickenSocketService.isConnected());

      chickenSocketService.on('connect', () => {
        console.log('Connected to chicken socket server');
        setIsConnected(true);
        
        // Get real game history
        chickenSocketService.getGameHistory().then((response) => {
          if (response.success && response.userHistory) {
            setGameHistory(response.userHistory);
            setBalance(response.balance || balance);
          }
        });
      });

      chickenSocketService.on('disconnect', () => {
        console.log('Disconnected from chicken socket server');
        setIsConnected(false);
      });

      // Clean up on unmount
      return () => {
        if (chickenSocketService.isConnected()) {
          chickenSocketService.disconnect();
        }
      };
    }
  }, [useMockData]);

  // Socket game updates
  useEffect(() => {
    if (!useMockData && isConnected) {
      // Game started event
      chickenSocketService.on('game_started', (data) => {
        console.log('Game started:', data);
        setIsPlaying(true);
        setIsWaiting(false);
        setCurrentMultiplier(1);
        setHasCrashed(false);
        setCrashPoint(null);
        setCashOutMultiplier(null);
      });

      // Multiplier update event
      chickenSocketService.on('multiplier_update', (data) => {
        console.log('Multiplier update:', data);
        setCurrentMultiplier(data.multiplier);
        
        // Auto cash out if set
        if (autoCashOut && data.multiplier >= autoCashOut) {
          chickenSocketService.cashOut().then((response) => {
            if (response.success) {
              setCashOutMultiplier(response.cashOutMultiplier);
            }
          });
        }
      });

      // Game ended event
      chickenSocketService.on('game_ended', (data) => {
        console.log('Game ended:', data);
        setHasCrashed(true);
        setCrashPoint(data.crashPoint);
        setIsPlaying(false);
        
        // Update game history
        chickenSocketService.getGameHistory(1).then((response) => {
          if (response.success && response.userHistory && response.userHistory.length > 0) {
            const latestGame = response.userHistory[0];
            setLastResult(latestGame);
            setGameHistory(prevHistory => [latestGame, ...prevHistory.slice(0, 9)]);
            setBalance(response.balance || balance);
          }
        });
      });

      // Clean up event listeners on component unmount
      return () => {
        chickenSocketService.off('game_started');
        chickenSocketService.off('multiplier_update');
        chickenSocketService.off('game_ended');
      };
    }
  }, [useMockData, isConnected, autoCashOut, balance]);

  // Handle placing a bet
  const handlePlaceBet = useCallback((betData) => {
    const { amount, autoCashOut, difficulty } = betData;
    
    setCurrentBet(amount);
    setAutoCashOut(autoCashOut);
    setCurrentDifficulty(difficulty);
    setIsWaiting(true);
    
    if (useMockData) {
      // Mock mode - simulate game
      setBalance(prev => prev - amount);
      
      // Start countdown
      let count = 3;
      setCountdown(count);
      
      const countdownInterval = setInterval(() => {
        count--;
        setCountdown(count);
        
        if (count <= 0) {
          clearInterval(countdownInterval);
          startMockGame(amount, autoCashOut, difficulty);
        }
      }, 1000);
    } else {
      // Socket mode - send bet to server
      chickenSocketService.startGame({
        betAmount: amount,
        autoCashOutMultiplier: autoCashOut,
        difficulty
      }).then((response) => {
        if (response.success) {
          setBalance(prevBalance => {
            return response.balance || (prevBalance - amount);
          });
          
          // Game will start via socket events
        } else {
          // Handle error
          setIsWaiting(false);
          console.error("Error placing bet:", response.error);
          // Show error message to user
        }
      });
    }
  }, [useMockData]);

  // Mock game implementation
  const startMockGame = useCallback((betAmount, autoCashOut, difficulty) => {
    setIsPlaying(true);
    setIsWaiting(false);
    setCurrentMultiplier(1);
    setHasCrashed(false);
    setCrashPoint(null);
    setCashOutMultiplier(null);
    
    // Generate a random result
    const mockResult = generateGameResult(Date.now().toString(), null, difficulty);
    const gameResult = {
      crashPoint: mockResult.crashPoint,
      difficulty,
      timestamp: new Date()
    };
    
    // Set up game animation and logic
    let multiplier = 1;
    const tickInterval = GAME_CONSTANTS.TICK_INTERVAL_MS;
    const growthRate = GAME_CONSTANTS.MULTIPLIER_GROWTH_RATE[difficulty];
    
    const gameInterval = setInterval(() => {
      multiplier += growthRate;
      setCurrentMultiplier(parseFloat(multiplier.toFixed(2)));
      
      // Check if auto cash out is triggered
      if (autoCashOut && multiplier >= autoCashOut && !cashOutMultiplier) {
        handleCashOut(true);
      }
      
      // Check if game should crash
      if (multiplier >= gameResult.crashPoint) {
        clearInterval(gameInterval);
        setHasCrashed(true);
        setCrashPoint(gameResult.crashPoint);
        
        // Game ended, record results
        const result = {
          id: Date.now(),
          timestamp: new Date(),
          betAmount,
          difficulty,
          crashPoint: gameResult.crashPoint,
          cashOutMultiplier: cashOutMultiplier,
          won: cashOutMultiplier !== null,
          profit: cashOutMultiplier ? 
            calculateProfit(betAmount, cashOutMultiplier) : 
            -betAmount
        };
        
        setLastResult(result);
        setGameHistory(prev => [result, ...prev.slice(0, 9)]);
        setIsPlaying(false);
        
        // If player cashed out, update balance
        if (cashOutMultiplier) {
          setBalance(prev => prev + (betAmount * cashOutMultiplier));
        }
      }
    }, tickInterval);
    
    // Clean up
    return () => {
      clearInterval(gameInterval);
    };
  }, [cashOutMultiplier]);

  // Handle manual cash out
  const handleCashOut = useCallback((isAuto = false) => {
    if (!isPlaying || hasCrashed) return;
    
    if (useMockData) {
      // Mock mode - handle locally
      setCashOutMultiplier(currentMultiplier);
    } else {
      // Socket mode - send to server
      chickenSocketService.cashOut().then((response) => {
        if (response.success) {
          setCashOutMultiplier(response.cashOutMultiplier);
        } else {
          console.error("Error cashing out:", response.error);
        }
      });
    }
  }, [isPlaying, hasCrashed, currentMultiplier, useMockData]);

  // Toggle between mock and real socket mode
  const toggleMockMode = () => {
    setUseMockData(prev => !prev);
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="mb-4 flex justify-between items-center">
        <div className="text-xl font-bold">Chicken Game</div>
        <div className="flex items-center gap-4">
          <div className="text-lg">Balance: <span className="font-bold">{balance.toFixed(2)}</span></div>
          <div className="flex items-center">
            <span className="mr-2 text-sm">Mock Mode:</span>
            <button 
              onClick={toggleMockMode} 
              className={`px-3 py-1 rounded-md text-sm ${useMockData ? 'bg-green-600' : 'bg-red-600'}`}
              disabled={isPlaying || isWaiting}
            >
              {useMockData ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="bg-gray-800 rounded-lg overflow-hidden" style={{ height: '400px' }}>
            <ChickenBoard 
              isPlaying={isPlaying}
              currentMultiplier={currentMultiplier}
              hasCrashed={hasCrashed}
              cashOutMultiplier={cashOutMultiplier}
              countdown={countdown}
              difficulty={currentDifficulty}
            />
          </div>
          
          <div className="mt-4 bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-2">Game History</h3>
            <div className="grid grid-cols-5 gap-2">
              {gameHistory.slice(0, 10).map((game, index) => (
                <div 
                  key={game.id || index} 
                  className={`p-2 rounded-md text-center ${
                    (game.won || (game.cashOutMultiplier && game.cashOutMultiplier <= game.crashPoint))
                      ? 'bg-green-800/30' 
                      : 'bg-red-800/30'
                  }`}
                >
                  <div className="font-bold">{game.crashPoint?.toFixed(2)}x</div>
                  <div className="text-xs opacity-70">
                    {game.timestamp ? new Date(game.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        <div className="lg:col-span-1">
          <ChickenBettingPanel
            balance={balance}
            onPlaceBet={handlePlaceBet}
            onCashOut={handleCashOut}
            isPlaying={isPlaying}
            isWaiting={isWaiting}
            currentMultiplier={currentMultiplier}
            gameHistory={gameHistory}
            lastResult={lastResult}
          />
        </div>
      </div>
      
      <div className="mt-8 bg-gray-800 p-4 rounded-lg">
        <h2 className="text-lg font-bold mb-4">How to Play</h2>
        <div className="space-y-2">
          <p>
            <strong>Chicken Game</strong> is a risk-versus-reward game where you try to cash out before the bomb explodes!
          </p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Place your bet and select a difficulty level.</li>
            <li>When the game starts, the multiplier will continuously increase.</li>
            <li>The higher the multiplier, the higher the chance of explosion.</li>
            <li>Cash out before the bomb explodes to win your bet multiplied by the current multiplier.</li>
            <li>If the bomb explodes before you cash out, you lose your bet.</li>
            <li>Optional: Set an auto cash-out multiplier to automatically secure your winnings.</li>
          </ol>
          <p className="mt-2">
            <strong>Difficulty levels:</strong>
          </p>
          <ul className="list-disc pl-5">
            <li><strong>Easy:</strong> Slower growth, lower risk, max 15x multiplier</li>
            <li><strong>Medium:</strong> Balanced growth and risk, max 30x multiplier</li>
            <li><strong>Hard:</strong> Faster growth, higher risk, potential for huge multipliers up to 100x</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ChickenGame;