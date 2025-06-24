import React, { useState, useEffect, useCallback, useContext } from 'react';
import RouletteWheel from './RouletteWheel';
import RouletteBettingPanel from './RouletteBettingPanel';
import RoulettePlayersList from './RoulettePlayersList';
import RouletteActiveBets from './RouletteActiveBets';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { AuthContext } from '../../contexts/AuthContext';
import rouletteSocketService from '../../services/socket/rouletteSocketService';
import { BET_TYPES } from './rouletteUtils';

const RouletteGame = () => {
  // Game state
  const [balance, setBalance] = useState(1000);
  const [betAmount, setBetAmount] = useState(10);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinPhase, setSpinPhase] = useState(null); // null, 'start', 'result', 'complete'
  const [spinData, setSpinData] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [gameResult, setGameResult] = useState(null);
  const [winningNumber, setWinningNumber] = useState(null);
  const [gameHistory, setGameHistory] = useState([]);
  const [currentBets, setCurrentBets] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [useMockData, setUseMockData] = useState(false); // Use real socket mode by default
  
  // Multiplayer state
  const [activePlayers, setActivePlayers] = useState([]);
  const [multiplayerBets, setMultiplayerBets] = useState([]);

  // Socket connection effect
  useEffect(() => {
    // Connect to roulette socket namespace
    if (!useMockData) {
      const connectSocket = async () => {
        try {
          // Initialize user info for multiplayer
          const userInfo = {
            userId: `user_${Math.floor(Math.random() * 10000)}`,
            username: `Player_${Math.floor(Math.random() * 10000)}`,
            avatar: null
          };
          
          // Set user info and connect to socket
          rouletteSocketService.setUser(userInfo);
          await rouletteSocketService.connect(userInfo);
          setIsConnected(true);
          
          // Join roulette game
          const gameData = await rouletteSocketService.joinGame();
          if (gameData.success) {
            setBalance(gameData.balance);
            setGameHistory(gameData.history || []);
          }
          
          // Set up multiplayer event listeners
          rouletteSocketService.onActivePlayers((players) => {
            console.log('Active players update:', players);
            setActivePlayers(players);
          });
          
          rouletteSocketService.onPlayerJoined((player) => {
            console.log('Player joined:', player);
            setActivePlayers(prev => [...prev, player]);
          });
          
          rouletteSocketService.onPlayerLeft((player) => {
            console.log('Player left:', player);
            setActivePlayers(prev => prev.filter(p => p.id !== player.id));
          });
          
          rouletteSocketService.onCurrentBets((bets) => {
            console.log('Current bets update:', bets);
            setMultiplayerBets(bets);
          });
          
          rouletteSocketService.onPlayerBet((bet) => {
            console.log('Player bet:', bet);
            setMultiplayerBets(prev => [...prev, bet]);
          });
          
          // Set up spin event listeners
          // IMPORTANT: Remove any existing listeners first to prevent duplicates
          rouletteSocketService.socket.off('roulette:spin_started');
          rouletteSocketService.socket.off('roulette:spin_result');
          rouletteSocketService.socket.off('roulette:round_complete');
          
          console.log('Setting up new spin event listeners');
          
          // Re-register event listeners
          rouletteSocketService.onSpinStarted((data) => {
            console.log('Spin started event received:', data);
            setIsSpinning(true);
            setSpinPhase('start');
            setSpinData(data.spinData);
            setShowResult(false); // Hide result during spinning
          });
          
          rouletteSocketService.onSpinResult((data) => {
            console.log('Spin result event received:', data);
            setSpinPhase('result');
            setWinningNumber(data.winningNumber);
            
            // Update balance with winnings/losses
            setBalance(prevBalance => {
              const newBalance = prevBalance + data.totalProfit;
              console.log(`Balance updated: ${prevBalance} + ${data.totalProfit} = ${newBalance}`);
              return newBalance;
            });
            
            // Create game result object
            const gameResultObj = {
              id: data.gameId,
              winningNumber: data.winningNumber,
              winningColor: data.winningColor,
              bets: data.bets,
              totalBetAmount: data.bets ? data.bets.reduce((sum, bet) => sum + bet.amount, 0) : 0,
              totalWinnings: data.totalWinnings,
              totalProfit: data.totalProfit,
              timestamp: new Date()
            };
            
            // Set current game result
            setGameResult(gameResultObj);
            
            // Add to game history
            setGameHistory(prevHistory => {
              const newHistory = [gameResultObj, ...prevHistory];
              console.log('Updated game history:', newHistory);
              return newHistory;
            });
            
            // Show result after a brief delay to allow the ball to settle
            setTimeout(() => {
              console.log('Showing result now');
              setShowResult(true);
            }, 1000);
          });
          
          rouletteSocketService.onRoundComplete(() => {
            console.log('Round complete event received');
            setIsSpinning(false);
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
    } else {
      // Mock data for multiplayer in development
      setActivePlayers([
        { id: 'player1', username: 'JohnDoe', avatar: null, joinedAt: Date.now() - 300000 },
        { id: 'player2', username: 'AliceSmith', avatar: null, joinedAt: Date.now() - 200000 },
        { id: 'player3', username: 'BobJohnson', avatar: null, joinedAt: Date.now() - 100000 },
      ]);
      
      setMultiplayerBets([
        { id: 'bet1', userId: 'player1', username: 'JohnDoe', type: 'RED', value: '', amount: 25 },
        { id: 'bet2', userId: 'player2', username: 'AliceSmith', type: 'STRAIGHT', value: '17', amount: 10 },
        { id: 'bet3', userId: 'player3', username: 'BobJohnson', type: 'EVEN', value: '', amount: 50 },
      ]);
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
  const handleSpin = async () => {
    try {
      // Check if already spinning
      if (isSpinning) {
        console.log('Already spinning, ignoring spin request');
        return;
      }
      
      // Check if there are active bets
      if (currentBets.length === 0) {
        alert('Place at least one bet before spinning');
        return;
      }
      
      // Temporarily disable the useMockData flag to ensure real socket events
      const actuallyUseMockData = false; // Force real mode for debugging
      let response;
      
      if (!actuallyUseMockData) {
        // Debug socket connection before spin
        console.log('Socket connection status before spin:', rouletteSocketService.isConnected);
        console.log('Socket object exists:', !!rouletteSocketService.socket);
        
        // Try to ensure connection is established
        try {
          console.log('Attempting to ensure socket connection...');
          await rouletteSocketService.ensureConnected();
          console.log('Socket connection ensured successfully');
        } catch (connError) {
          console.error('Failed to connect socket:', connError);
          alert('Cannot connect to game server. Please refresh the page.');
          return;
        }
        
        // Use the real server
        console.log('Initiating real spin via socket');
        response = await rouletteSocketService.spin(currentBets);
        
        // The first response from the server just contains spin parameters
        // The actual spin result will come later via socket events
        if (response.success) {
          console.log('Real spin initiated successfully:', response);
          // Server will emit the events: onSpinStarted, onSpinResult, onRoundComplete
        } else {
          console.error('Error initiating spin:', response);
          alert('Error spinning the wheel. Please try again.');
          return;
        }
      } else {
        // Mockup data for testing
        setIsSpinning(true);
        setSpinPhase('start');
        
        // Create mock spin data
        const mockSpinData = {
          phase1Angle: 3600, // 10 rotations
          phase2Angle: 2160, // 6 rotations
          phase3Angle: 720,  // 2 rotations
          durations: {
            phase1: 3000,
            phase2: 4000,
            phase3: 3000,
            total: 10000
          }
        };
        
        setSpinData(mockSpinData);
        
        // Simulate server delay and phases
        // Phase 1: Start spinning
        console.log('Mock: Starting spin animation');
        
        // Phase 2: Reveal result (after 9 seconds)
        setTimeout(() => {
          // Process bet results using mock function
          const result = mockRouletteSpin(currentBets);
          console.log('Mock spin result:', result);
          
          setSpinPhase('result');
          setWinningNumber(result.winningNumber);
          
          // Update balance with winnings/losses
          setBalance(prev => prev + result.totalProfit);
          
          // Create game result object with timestamp
          const gameResult = {
            id: Date.now().toString(),
            timestamp: new Date(),
            winningNumber: result.winningNumber,
            winningColor: result.winningColor,
            bets: result.bets,
            totalBetAmount: currentBets.reduce((sum, bet) => sum + bet.amount, 0),
            totalWinnings: result.totalWinnings,
            totalProfit: result.totalProfit
          };
          
          // Display the result
          setGameResult(gameResult);
          
          // Add to history
          setGameHistory(prev => [gameResult, ...prev]);
          
          // Show result after a short delay
          setTimeout(() => {
            setShowResult(true);
          }, 1000);
          
        }, mockSpinData.durations.total - 1000);
        
        // Phase 3: Complete round (after 13 seconds)
        setTimeout(() => {
          setSpinPhase('complete');
          setCurrentBets([]);
          setIsSpinning(false);
        }, mockSpinData.durations.total + 3000);
      }
    } catch (error) {
      console.error('Error spinning wheel:', error);
      alert(error.message);
      setIsSpinning(false);
    }      
  };

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
        <div className="relative">
          <RouletteWheel
            spinning={isSpinning}
            spinData={spinData}
            winningNumber={winningNumber}
            showResult={showResult}
            onSpinComplete={() => {
              // This callback is triggered when the local animation completes
              // We don't set isSpinning=false here because we follow the server states
            }}
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
        {gameResult && !isSpinning && (
          <Card title="Last Spin Results" className="bg-gray-800">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-400">Winning Number:</span>
                <div className="flex items-center">
                  {getNumberColorBadge(gameResult.winningNumber)}
                  <span className="font-bold ml-2">{gameResult.winningNumber}</span>
                </div>
              </div>
              
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-400 mb-1">Bets</h4>
                <div className="space-y-2">
                  {gameResult.bets.map((bet, index) => (
                    <div key={index} className="flex justify-between items-center text-sm">
                      <div>
                        <span className="text-gray-300">{bet.type}</span>
                        {bet.value && <span className="text-gray-400"> - {bet.value}</span>}
                        <span className="text-gray-400"> (${bet.amount.toFixed(2)})</span>
                      </div>
                      <div className={bet.isWinner ? 'text-green-500 font-bold' : 'text-red-500'}>
                        {bet.isWinner ? `+${bet.profit.toFixed(2)}` : `-${bet.amount.toFixed(2)}`}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-2 border-t border-gray-700 flex justify-between">
                  <div className="text-gray-300">Total</div>
                  <div className={`font-bold ${gameResult.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {gameResult.totalProfit >= 0 ? '+' : ''}{gameResult.totalProfit.toFixed(2)}
                  </div>
                </div>
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
        
        {/* Active bets from all players */}
        <div className="mt-4">
          <RouletteActiveBets bets={multiplayerBets} />
        </div>
        
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
          
          {/* Active players list */}
          <div className="mt-4 border-t border-gray-700 pt-4">
            <RoulettePlayersList players={activePlayers} />
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