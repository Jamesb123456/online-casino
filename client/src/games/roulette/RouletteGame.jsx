import React, { useState, useEffect, useCallback } from 'react';
import RouletteWheel from './RouletteWheel';
import RouletteBettingPanel from './RouletteBettingPanel';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import rouletteSocketService from './rouletteSocketService';
import { BET_TYPES } from './rouletteUtils';

const RouletteGame = () => {
  // Game state
  const [balance, setBalance] = useState(1000);
  const [betAmount, setBetAmount] = useState(10);
  const [isSpinning, setIsSpinning] = useState(false);
  const [targetAngle, setTargetAngle] = useState(0);
  const [gameResult, setGameResult] = useState(null);
  const [winningNumber, setWinningNumber] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [currentBets, setCurrentBets] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [useMockData, setUseMockData] = useState(true); // Toggle for mock mode/socket mode

  // Socket connection effect
  useEffect(() => {
    // Connect to roulette socket namespace
    if (!useMockData) {
      const connectSocket = async () => {
        try {
          // Connect to socket
          await rouletteSocketService.connect();
          setIsConnected(true);
          
          // Join roulette game
          const gameData = await rouletteSocketService.joinGame();
          if (gameData.success) {
            setBalance(gameData.balance);
            setGameHistory(gameData.history || []);
          }
          
          // Set up event listeners
          rouletteSocketService.on('game_result', (data) => {
            console.log('Received game result:', data);
          });
          
        } catch (error) {
          console.error('Error connecting to roulette game:', error);
          setUseMockData(true); // Fall back to mock data on connection error
        }
      };
      
      connectSocket();
      
      // Cleanup on unmount
      return () => {
        rouletteSocketService.disconnect();
        setIsConnected(false);
      };
    }
  }, [useMockData]);

  // Handle placing a bet
  const handlePlaceBet = useCallback((bet) => {
    if (isSpinning || betAmount <= 0) return;
    
    // Validate bet amount doesn't exceed balance
    if (betAmount > balance) {
      alert('Insufficient balance');
      return;
    }
    
    // Add bet to current bets
    const newBet = {
      id: Date.now(),
      type: bet.type,
      value: bet.value,
      amount: betAmount,
      payout: BET_TYPES[bet.type].payout
    };
    
    if (useMockData) {
      // Mock mode - handle locally
      setBalance(prevBalance => prevBalance - betAmount);
      setCurrentBets(prevBets => [...prevBets, newBet]);
    } else {
      // Socket mode - send to server
      rouletteSocketService.placeBet({
        type: bet.type,
        value: bet.value,
        amount: betAmount
      }).then(response => {
        if (response.success) {
          setBalance(response.balance);
          setCurrentBets(response.currentBets);
        } else {
          console.error('Error placing bet:', response.error);
          alert(response.error || 'Failed to place bet');
        }
      });
    }
  }, [isSpinning, betAmount, balance, useMockData]);

  // Handle spin
  const handleSpin = useCallback(() => {
    if (isSpinning || currentBets.length === 0) return;
    
    setIsSpinning(true);
    setGameResult(null);
    
    if (useMockData) {
      // Generate a mock random result
      const mockIndex = Math.floor(Math.random() * 37); // 0-36 for roulette
      const mockAngle = 6 * 360 - (mockIndex * (360 / 37)); // 6 full rotations minus position
      setTargetAngle(mockAngle);
      setWinningNumber(mockIndex);
      
    } else {
      // Socket mode - send to server
      rouletteSocketService.spinWheel()
        .then(response => {
          if (response.success) {
            setTargetAngle(response.targetAngle);
            setWinningNumber(response.winningNumber);
          } else {
            console.error('Error spinning wheel:', response.error);
            alert(response.error || 'Failed to spin wheel');
            setIsSpinning(false);
          }
        })
        .catch(error => {
          console.error('Error spinning wheel:', error);
          setIsSpinning(false);
        });
    }
  }, [isSpinning, currentBets, useMockData]);

  // Handle spin completion
  // Listen for socket game results
  useEffect(() => {
    if (!useMockData && isConnected) {
      // Set up listener for game results
      rouletteSocketService.on('game_result', (data) => {
        console.log('Received game result from server:', data);
      });
      
      return () => {
        rouletteSocketService.off('game_result');
      };
    }
  }, [useMockData, isConnected]);

  const handleSpinComplete = useCallback(() => {
    if (!winningNumber && winningNumber !== 0) return;
    
    if (useMockData) {
      // Mock mode - calculate results locally
      
      // Determine winning bets
      const results = currentBets.map(bet => {
        let isWinner = false;
        
        // Check if bet is a winner based on type and winning number
        switch (bet.type) {
          case 'STRAIGHT':
            isWinner = parseInt(bet.value) === winningNumber;
            break;
          case 'RED':
            isWinner = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(winningNumber);
            break;
          case 'BLACK':
            isWinner = [2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35].includes(winningNumber);
            break;
          case 'ODD':
            isWinner = winningNumber > 0 && winningNumber % 2 === 1;
            break;
          case 'EVEN':
            isWinner = winningNumber > 0 && winningNumber % 2 === 0;
            break;
          case 'LOW':
            isWinner = winningNumber >= 1 && winningNumber <= 18;
            break;
          case 'HIGH':
            isWinner = winningNumber >= 19 && winningNumber <= 36;
            break;
          case 'DOZEN':
            const dozen = parseInt(bet.value);
            isWinner = 
              (dozen === 1 && winningNumber >= 1 && winningNumber <= 12) ||
              (dozen === 2 && winningNumber >= 13 && winningNumber <= 24) ||
              (dozen === 3 && winningNumber >= 25 && winningNumber <= 36);
            break;
          case 'COLUMN':
            const column = parseInt(bet.value);
            isWinner = winningNumber > 0 && winningNumber % 3 === (column === 1 ? 1 : column === 2 ? 2 : 0);
            break;
          default:
            isWinner = false;
        }
        
        // Calculate winnings
        const winAmount = isWinner ? bet.amount * (bet.payout + 1) : 0;
        const profit = isWinner ? bet.amount * bet.payout : -bet.amount;
        
        return {
          ...bet,
          isWinner,
          winAmount,
          profit
        };
      });
      
      // Calculate totals
      const totalWinnings = results.reduce((sum, bet) => sum + (bet.winAmount || 0), 0);
      const totalProfit = results.reduce((sum, bet) => sum + bet.profit, 0);
      
      // Create game result
      const result = {
        id: Date.now(),
        timestamp: new Date(),
        winningNumber,
        bets: results,
        totalBetAmount: results.reduce((sum, bet) => sum + bet.amount, 0),
        totalWinnings,
        totalProfit
      };
      
      // Update game state
      setGameHistory(prev => [result, ...prev.slice(0, 9)]);
      setGameResult(result);
      setBalance(prev => prev + totalWinnings);
      
      // Reset game state
      setCurrentBets([]);
      setIsSpinning(false);
    } else {
      // For socket mode, receive the results from the server
      // The spin function already handles the server call and response
      // Here we just update the UI with the results when animation completes
      
      // Get the latest result from server (already available since the spin call)
      rouletteSocketService.getGameHistory(1)
        .then(response => {
          if (response.success && response.userHistory && response.userHistory.length > 0) {
            const latestResult = response.userHistory[0];
            
            // Update game state with server data
            setGameResult(latestResult);
            setGameHistory(prev => [latestResult, ...prev.slice(0, 9)]);
            setBalance(prevBalance => {
              // Balance might have already been updated by the spin response
              // This is to ensure we have the most up-to-date value
              return response.balance || prevBalance;
            });
          }
          
          // Reset game state
          setCurrentBets([]);
          setIsSpinning(false);
        })
        .catch(error => {
          console.error('Error getting game history:', error);
          setIsSpinning(false);
        });
    }
  }, [winningNumber, currentBets, useMockData, isConnected]);

  // Format timestamp for display
  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  
  // Get color badge for a number
  const getNumberColorBadge = (number) => {
    if (number === 0) {
      return <Badge color="green">{number}</Badge>;
    } else if ((number % 2) === 0) {
      return <Badge color="black">{number}</Badge>;
    } else {
      return <Badge color="red">{number}</Badge>;
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-8/12 space-y-4">
        {/* Roulette wheel */}
        <div className="relative bg-gray-800 rounded-lg p-6">
          <RouletteWheel
            spinning={isSpinning}
            targetAngle={targetAngle}
            onSpinComplete={handleSpinComplete}
            winningNumber={winningNumber}
          />
          
          {/* Spin button */}
          <div className="mt-4 flex justify-center">
            <button
              onClick={handleSpin}
              disabled={isSpinning || currentBets.length === 0}
              className={`
                px-6 py-3 rounded-lg font-bold text-white text-lg
                ${currentBets.length === 0 || isSpinning
                  ? 'bg-gray-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-red-600 to-red-800 hover:from-red-500 hover:to-red-700'}
              `}
            >
              {isSpinning ? 'Spinning...' : 'SPIN'}
            </button>
          </div>
          
          {/* Current bets display */}
          {currentBets.length > 0 && (
            <div className="mt-4">
              <h3 className="text-lg font-medium text-gray-300 mb-2">Current Bets</h3>
              <div className="flex flex-wrap gap-2">
                {currentBets.map(bet => (
                  <div key={bet.id} className="bg-gray-700 rounded px-3 py-1 text-sm">
                    <span className="text-amber-400">{BET_TYPES[bet.type].name}</span>
                    {bet.value && <span className="text-gray-300"> - {bet.value}</span>}
                    <span className="text-gray-400"> ({bet.amount})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Game results and history */}
        <Card title="Spin History">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Number</th>
                  <th className="pb-2">Bets</th>
                  <th className="pb-2">Wagered</th>
                  <th className="pb-2">Profit</th>
                </tr>
              </thead>
              <tbody>
                {gameHistory.length > 0 ? (
                  gameHistory.map(game => (
                    <tr key={game.id} className="border-b border-gray-800">
                      <td className="py-2">{formatTime(game.timestamp)}</td>
                      <td className="py-2">{getNumberColorBadge(game.winningNumber)}</td>
                      <td className="py-2">{game.bets.length}</td>
                      <td className="py-2">{game.totalBetAmount.toFixed(2)}</td>
                      <td className={`py-2 font-bold ${
                        game.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {game.totalProfit >= 0 ? '+' : ''}{game.totalProfit.toFixed(2)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-gray-400">
                      No games played yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
        
        {/* Last result details */}
        {gameResult && (
          <Card title="Last Spin Results" className="bg-gray-800">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Winning Number:</span>
                <span className="font-bold">{getNumberColorBadge(gameResult.winningNumber)}</span>
              </div>
              
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-400 mb-1">Bets</h4>
                <div className="space-y-2">
                  {gameResult.bets.map((bet, index) => (
                    <div key={index} className="flex justify-between bg-gray-700 rounded px-3 py-2">
                      <div>
                        <span className="font-medium">{BET_TYPES[bet.type].name}</span>
                        {bet.value && <span className="text-gray-300"> - {bet.value}</span>}
                        <span className="text-sm text-gray-400 ml-2">({bet.amount})</span>
                      </div>
                      <div className={bet.isWinner ? 'text-green-500 font-bold' : 'text-red-500'}>
                        {bet.isWinner ? `+${bet.profit.toFixed(2)}` : bet.profit.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="flex justify-between pt-2 border-t border-gray-700">
                <span className="font-medium">Total Profit:</span>
                <span className={`font-bold ${
                  gameResult.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'
                }`}>
                  {gameResult.totalProfit >= 0 ? '+' : ''}{gameResult.totalProfit.toFixed(2)}
                </span>
              </div>
            </div>
          </Card>
        )}
      </div>
      
      <div className="lg:w-4/12">
        {/* Betting panel */}
        <RouletteBettingPanel
          betAmount={betAmount}
          setBetAmount={setBetAmount}
          onPlaceBet={handlePlaceBet}
          isSpinning={isSpinning}
          balance={balance}
        />
        
        {/* Game statistics */}
        <Card title="Statistics" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">Spins</div>
              <div className="text-lg font-bold">{gameHistory.length}</div>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">Total Wagered</div>
              <div className="text-lg font-bold">
                {gameHistory.reduce((sum, game) => sum + game.totalBetAmount, 0).toFixed(2)}
              </div>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">Total Profit</div>
              <div className={`text-lg font-bold ${
                gameHistory.reduce((sum, game) => sum + game.totalProfit, 0) >= 0 
                  ? 'text-green-500' 
                  : 'text-red-500'
              }`}>
                {gameHistory.reduce((sum, game) => sum + game.totalProfit, 0).toFixed(2)}
              </div>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">Best Win</div>
              <div className="text-lg font-bold text-green-500">
                {gameHistory.length > 0
                  ? Math.max(...gameHistory.map(g => g.totalProfit)).toFixed(2)
                  : '0.00'
                }
              </div>
            </div>
          </div>
          
          {/* Socket connection toggle */}
          <div className="mt-4 border-t border-gray-700 pt-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-sm text-gray-400">Data Source:</span>
                <span className="ml-2 text-sm font-medium">
                  {useMockData ? 'Mock Data' : 'Real-time Server'}
                </span>
              </div>
              <button
                onClick={() => setUseMockData(prev => !prev)}
                className={`
                  px-3 py-1 text-xs font-medium rounded
                  ${useMockData 
                    ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                    : 'bg-green-600 hover:bg-green-500 text-white'}
                `}
              >
                {useMockData ? 'Use Server Data' : 'Use Mock Data'}
              </button>
            </div>
            
            {/* Connection status */}
            {!useMockData && (
              <div className="mt-2 text-xs">
                <span className="text-gray-400">Socket Status: </span>
                {isConnected ? (
                  <span className="text-green-500 font-medium">Connected</span>
                ) : (
                  <span className="text-red-500 font-medium">Disconnected</span>
                )}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

export default RouletteGame;