import React, { useState, useEffect, useCallback } from 'react';
import LandminesBoard from './LandminesBoard';
import LandminesBettingPanel from './LandminesBettingPanel';
import Card from '../../components/ui/Card';
import { formatCurrency, formatTime, getMultiplierColor } from './landminesUtils';
import landminesSocketService from '../../services/socket/landminesSocketService';

// For development, toggle between mock and real socket
const USE_MOCK_SOCKET = true;

const LandminesGame = () => {
  // Game state
  const [isGameActive, setIsGameActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [grid, setGrid] = useState(null);
  const [revealedCells, setRevealedCells] = useState([]);
  const [mines, setMines] = useState(5);
  const [betAmount, setBetAmount] = useState(10);
  const [potentialWin, setPotentialWin] = useState(0);
  const [gameHistory, setGameHistory] = useState([]);
  const [gameResult, setGameResult] = useState(null);
  const [remainingSafeCells, setRemainingSafeCells] = useState(0);
  const [balance, setBalance] = useState(1000);

  // Connect to socket when component mounts
  useEffect(() => {
    if (!USE_MOCK_SOCKET) {
      // Join the Landmines game room
      landminesSocketService.joinLandminesGame((response) => {
        if (response.success) {
          setBalance(response.balance);
          setGameHistory(response.history || []);
        }
      });
      
      // Cleanup when component unmounts
      return () => {
        landminesSocketService.leaveLandminesGame();
      };
    }
  }, []);

  // Handle starting a new game
  const handleStartGame = useCallback(({ betAmount, mines }) => {
    // Validate inputs
    if (typeof betAmount !== 'number' || typeof mines !== 'number') {
      console.error('Invalid start game parameters:', { betAmount, mines });
      return;
    }
    
    setIsLoading(true);
    setBetAmount(betAmount);
    setMines(mines);
    
    try {
      if (USE_MOCK_SOCKET) {
        // Clear any previous session storage to avoid conflicts
        try {
          sessionStorage.removeItem('landmines_mock_grid');
          sessionStorage.removeItem('landmines_mock_revealed');
        } catch (e) {
          console.warn('Failed to clear session storage:', e);
        }
        
        // Mock implementation for development
        landminesSocketService.mockStartGame({ betAmount, mines }, (response) => {
          try {
            if (!response || typeof response !== 'object') {
              console.error('Invalid response from mockStartGame', response);
              setIsLoading(false);
              return;
            }
            
            if (response.success) {
              setIsGameActive(true);
              setRevealedCells([]);
              setGrid(null); // Grid is hidden until game over
              setPotentialWin(0);
              setBalance(prev => prev - betAmount);
              setRemainingSafeCells(25 - mines);
              setGameResult(null);
            } else {
              console.error('Failed to start game:', response.error);
            }
          } catch (error) {
            console.error('Error processing start game response:', error);
          } finally {
            setIsLoading(false);
          }
        });
      } else {
        // Real socket implementation
        landminesSocketService.startGame({ betAmount, mines }, (response) => {
          try {
            if (response.success) {
              setIsGameActive(true);
              setRevealedCells([]);
              setGrid(null); // Grid is hidden until game over
              setPotentialWin(0);
              setBalance(response.balance);
              setRemainingSafeCells(25 - mines);
              setGameResult(null);
            } else {
              // Show error
              console.error('Error starting game:', response.error);
            }
          } catch (error) {
            console.error('Error processing start game response:', error);
          } finally {
            setIsLoading(false);
          }
        });
      }
    } catch (error) {
      console.error('Error in handleStartGame:', error);
      setIsLoading(false);
    }
  }, []);

  // Handle clicking on a cell
  const handleCellClick = useCallback((row, col) => {
    // Defensive checks
    if (!isGameActive || isLoading || typeof row !== 'number' || typeof col !== 'number') {
      console.warn('Invalid cell click:', { row, col, isGameActive, isLoading });
      return;
    }
    
    // Additional bounds check
    if (row < 0 || row > 4 || col < 0 || col > 4) {
      console.error('Cell click out of bounds:', { row, col });
      return;
    }
    
    setIsLoading(true);
    
    try {
      if (USE_MOCK_SOCKET) {
        // Mock implementation for development
        landminesSocketService.mockPickCell({ row, col }, (response) => {
          try {
            if (!response || typeof response !== 'object') {
              console.error('Invalid response from mockPickCell', response);
              setIsLoading(false);
              return;
            }
            
            if (response.success) {
              // Add the cell to revealed cells
              setRevealedCells(prev => [...(prev || []), `${row},${col}`]);
              
              if (response.hit) {
                // Game over - hit a mine
                // Safety check for grid
                if (response.fullGrid && Array.isArray(response.fullGrid)) {
                  setGrid(response.fullGrid);
                }
                
                setIsGameActive(false);
                setGameResult({
                  win: false,
                  message: 'Mine Hit!',
                  profit: -(betAmount || 0)
                });
                
                // Update history
                const result = {
                  id: Date.now(),
                  timestamp: new Date(),
                  betAmount: betAmount || 0,
                  mines: mines || 5,
                  hit: true,
                  profit: -(betAmount || 0),
                  revealedCount: (revealedCells || []).length + 1
                };
                setGameHistory(prev => [result, ...(prev || []).slice(0, 9)]);
              } else {
                // Found a diamond
                if (typeof response.remainingSafeCells === 'number') {
                  setRemainingSafeCells(response.remainingSafeCells);
                }
                
                if (typeof response.potentialWin === 'number') {
                  setPotentialWin(response.potentialWin);
                }
                
                if (response.gameOver) {
                  // All safe cells found - automatic win!
                  // Safety check for grid
                  if (response.fullGrid && Array.isArray(response.fullGrid)) {
                    setGrid(response.fullGrid);
                  }
                  
                  setIsGameActive(false);
                  setGameResult({
                    win: true,
                    message: 'All Diamonds Found!',
                    amount: response.potentialWin || 0,
                    profit: (response.potentialWin || 0) - (betAmount || 0)
                  });
                  
                  // Update history
                  const result = {
                    id: Date.now(),
                    timestamp: new Date(),
                    betAmount: betAmount || 0,
                    mines: mines || 5,
                    cashOut: true,
                    multiplier: response.multiplier || 1,
                    winAmount: response.potentialWin || 0,
                    profit: (response.potentialWin || 0) - (betAmount || 0),
                    revealedCount: (revealedCells || []).length + 1
                  };
                  setGameHistory(prev => [result, ...(prev || []).slice(0, 9)]);
                }
              }
            } else {
              // Handle error
              console.error('Error picking cell:', response.error);
            }
          } catch (error) {
            console.error('Error processing pick cell response:', error);
          } finally {
            setIsLoading(false);
          }
        });
      } else {
        // Real socket implementation
        landminesSocketService.pickCell({ row, col }, (response) => {
          try {
            if (response.success) {
              // Add the cell to revealed cells
              setRevealedCells(prev => [...(prev || []), `${row},${col}`]);
              
              if (response.hit) {
                // Game over - hit a mine
                if (response.fullGrid && Array.isArray(response.fullGrid)) {
                  setGrid(response.fullGrid);
                }
                setIsGameActive(false);
                setGameResult({
                  win: false,
                  message: 'Mine Hit!',
                  profit: -(betAmount || 0)
                });
                if (typeof response.balance === 'number') {
                  setBalance(response.balance);
                }
                
                // Update history
                const result = {
                  id: Date.now(), 
                  timestamp: new Date(),
                  betAmount: betAmount || 0,
                  mines: mines || 5,
                  hit: true,
                  profit: -(betAmount || 0),
                  revealedCount: (revealedCells || []).length + 1
                };
                setGameHistory(prev => [result, ...(prev || []).slice(0, 9)]);
              } else {
                // Found a diamond
                if (typeof response.remainingSafeCells === 'number') {
                  setRemainingSafeCells(response.remainingSafeCells);
                }
                if (typeof response.potentialWin === 'number') {
                  setPotentialWin(response.potentialWin);
                }
                if (typeof response.balance === 'number') {
                  setBalance(response.balance);
                }
                
                // Check if all safe cells have been revealed (auto-cashout)
                if (response.gameOver) {
                  if (response.fullGrid && Array.isArray(response.fullGrid)) {
                    setGrid(response.fullGrid);
                  }
                  setIsGameActive(false);
                  setGameResult({
                    win: true,
                    message: 'All Diamonds Found!',
                    amount: response.potentialWin || 0,
                    profit: (response.potentialWin || 0) - (betAmount || 0)
                  });
                  
                  // Update history
                  const result = {
                    id: Date.now(),
                    timestamp: new Date(),
                    betAmount: betAmount || 0,
                    mines: mines || 5,
                    hit: false,
                    multiplier: response.multiplier || 1,
                    winAmount: response.potentialWin || 0,
                    profit: (response.potentialWin || 0) - (betAmount || 0),
                    revealedCount: (revealedCells || []).length + 1
                  };
                  setGameHistory(prev => [result, ...(prev || []).slice(0, 9)]);
                }
              }
            } else {
              // Show error
              console.error('Error picking cell:', response.error);
            }
          } catch (error) {
            console.error('Error processing pick cell response:', error);
          } finally {
            setIsLoading(false);
          }
        });
      }
    } catch (error) {
      console.error('Error in handleCellClick:', error);
      setIsLoading(false);
    }
  }, [isGameActive, isLoading, revealedCells, betAmount, mines]);

  // Handle cash out
  const handleCashOut = useCallback(() => {
    if (!isGameActive || isLoading) return;
    
    setIsLoading(true);
    
    try {
      if (USE_MOCK_SOCKET) {
        // Mock implementation for development
        landminesSocketService.mockCashOut((response) => {
          try {
            if (!response || typeof response !== 'object') {
              console.error('Invalid response from mockCashOut', response);
              setIsLoading(false);
              return;
            }
            
            if (response.success) {
              // Game over - cashed out successfully
              // Safety check for grid
              if (response.fullGrid && Array.isArray(response.fullGrid)) {
                setGrid(response.fullGrid);
              }
              
              setIsGameActive(false);
              setGameResult({
                win: true,
                message: 'Cashed Out!',
                amount: response.winAmount || 0,
                profit: response.profit || 0
              });
              
              // Update history
              const result = {
                id: Date.now(),
                timestamp: new Date(),
                betAmount: betAmount || 0,
                mines: mines || 5,
                cashOut: true,
                multiplier: response.multiplier || 1,
                winAmount: response.winAmount || 0,
                profit: response.profit || 0,
                revealedCount: (revealedCells || []).length
              };
              setGameHistory(prev => [result, ...(prev || []).slice(0, 9)]);
              
              // Update balance
              setBalance(prev => prev + (response.winAmount || 0));
            } else {
              // Handle error
              console.error('Error cashing out:', response.error);
            }
          } catch (error) {
            console.error('Error processing cash out response:', error);
          } finally {
            setIsLoading(false);
          }
        });
      } else {
        // Real socket implementation
        landminesSocketService.cashOut((response) => {
          try {
            if (response.success) {
              if (response.fullGrid && Array.isArray(response.fullGrid)) {
                setGrid(response.fullGrid);
              }
              setIsGameActive(false);
              setGameResult({
                win: true,
                message: 'Cashed Out!',
                amount: response.winAmount || 0,
                profit: response.profit || 0
              });
              if (typeof response.balance === 'number') {
                setBalance(response.balance);
              }
              
              // Update history
              const result = {
                id: Date.now(),
                timestamp: new Date(),
                betAmount: betAmount || 0,
                mines: mines || 5,
                hit: false,
                cashOut: true,
                multiplier: response.multiplier || 1,
                winAmount: response.winAmount || 0,
                profit: response.profit || 0,
                revealedCount: (revealedCells || []).length
              };
              setGameHistory(prev => [result, ...(prev || []).slice(0, 9)]);
            } else {
              // Show error
              console.error('Error cashing out:', response.error);
            }
          } catch (error) {
            console.error('Error processing cash out response:', error);
          } finally {
            setIsLoading(false);
          }
        });
      }
    } catch (error) {
      console.error('Error in handleCashOut:', error);
      setIsLoading(false);
    }
  }, [isGameActive, isLoading, potentialWin, betAmount, mines, revealedCells]);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-8/12 space-y-4">
        {/* Game board */}
        <Card title="Landmines" className="relative">
          <LandminesBoard
            grid={grid}
            revealedCells={revealedCells}
            onCellClick={handleCellClick}
            isGameActive={isGameActive}
            gameOver={!!gameResult}
            loading={isLoading}
          />
          
          {/* Game result overlay */}
          {gameResult && (
            <div className={`
              absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2
              px-6 py-3 rounded-lg font-bold text-white text-2xl
              ${gameResult.win ? 'bg-green-600' : 'bg-red-600'}
            `}>
              {gameResult.win ? 
                `+${formatCurrency(gameResult.profit)}` : 
                `${formatCurrency(gameResult.profit)}`
              }
            </div>
          )}
        </Card>
        
        {/* Game history */}
        <Card title="Game History">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-700">
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Bet</th>
                  <th className="pb-2">Mines</th>
                  <th className="pb-2">Revealed</th>
                  <th className="pb-2">Result</th>
                  <th className="pb-2">Profit</th>
                </tr>
              </thead>
              <tbody>
                {gameHistory.length > 0 ? (
                  gameHistory.map(game => (
                    <tr key={game.id} className="border-b border-gray-800">
                      <td className="py-2">{formatTime(game.timestamp)}</td>
                      <td className="py-2">{formatCurrency(game.betAmount)}</td>
                      <td className="py-2">{game.mines}</td>
                      <td className="py-2">{game.revealedCount}</td>
                      <td className="py-2">
                        {game.hit ? 
                          <span className="text-red-500">Mine Hit</span> : 
                          <span className={getMultiplierColor(game.multiplier)}>
                            {game.multiplier?.toFixed(2)}x {game.cashOut ? '(Cash Out)' : ''}
                          </span>
                        }
                      </td>
                      <td className={`py-2 font-bold ${
                        game.profit >= 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {game.profit >= 0 ? '+' : ''}{formatCurrency(game.profit)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-gray-400">
                      No games played yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      
      <div className="lg:w-4/12">
        <LandminesBettingPanel
          onStartGame={handleStartGame}
          onCashOut={handleCashOut}
          isGameActive={isGameActive}
          isLoading={isLoading}
          potentialWin={potentialWin}
          revealedCount={revealedCells.length}
          remainingSafeCells={remainingSafeCells}
          mines={mines}
        />
        
        {/* Game statistics */}
        <Card title="Game Stats" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">Games Played</div>
              <div className="text-lg font-bold">{gameHistory.length}</div>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">Total Wagered</div>
              <div className="text-lg font-bold">
                {formatCurrency(gameHistory.reduce((sum, game) => sum + game.betAmount, 0))}
              </div>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">Total Profit</div>
              <div className={`text-lg font-bold ${
                gameHistory.reduce((sum, game) => sum + game.profit, 0) >= 0 
                  ? 'text-green-500' 
                  : 'text-red-500'
              }`}>
                {formatCurrency(gameHistory.reduce((sum, game) => sum + game.profit, 0))}
              </div>
            </div>
            <div className="bg-gray-800 p-3 rounded">
              <div className="text-xs text-gray-400">Best Win</div>
              <div className="text-lg font-bold text-green-500">
                {gameHistory.length > 0
                  ? formatCurrency(Math.max(0, ...gameHistory.map(g => g.profit)))
                  : formatCurrency(0)
                }
              </div>
            </div>
          </div>
          
          <div className="mt-4 bg-gray-800 p-3 rounded">
            <div className="flex justify-between">
              <span className="text-gray-400">Balance</span>
              <span className="font-bold">{formatCurrency(balance)}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default LandminesGame;
