import React, { useState, useEffect, useCallback } from 'react';
import LandminesBoard from './LandminesBoard';
import LandminesBettingPanel from './LandminesBettingPanel';
import { formatCurrency, formatTime, getMultiplierColor } from './landminesUtils';
import landminesSocketService from '../../services/socket/landminesSocketService';

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
      // Send start game request to server via socket
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
      // Send pick cell request to server via socket
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
      // Send cash out request to server via socket
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
    } catch (error) {
      console.error('Error in handleCashOut:', error);
      setIsLoading(false);
    }
  }, [isGameActive, isLoading, potentialWin, betAmount, mines, revealedCells]);

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      <div className="lg:w-8/12 space-y-4">
        {/* Game board */}
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden p-5 relative">
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
            <div role="alert" className={`
              absolute top-1/4 left-1/2 transform -translate-x-1/2 -translate-y-1/2
              rounded-xl p-6 shadow-lg backdrop-blur-xl
              ${gameResult.win
                ? 'bg-bg-card/95 border border-status-success/30'
                : 'bg-bg-card/95 border border-status-error/30'}
            `}>
              <div className={`text-3xl font-heading font-bold ${
                gameResult.win ? 'text-status-success' : 'text-status-error'
              }`}>
                {gameResult.win ?
                  `+${formatCurrency(gameResult.profit)}` :
                  `${formatCurrency(gameResult.profit)}`
                }
              </div>
            </div>
          )}
        </div>
        
        {/* Game history */}
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden mt-4">
          <div className="p-4 pb-0">
            <h3 className="text-lg font-heading font-bold text-text-primary mb-3">Game History</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-elevated text-text-muted text-xs font-heading uppercase tracking-wider">
                  <th className="py-2 px-4 text-left">Time</th>
                  <th className="py-2 px-4 text-left">Bet</th>
                  <th className="py-2 px-4 text-left">Mines</th>
                  <th className="py-2 px-4 text-left">Revealed</th>
                  <th className="py-2 px-4 text-left">Result</th>
                  <th className="py-2 px-4 text-left">Profit</th>
                </tr>
              </thead>
              <tbody>
                {gameHistory.length > 0 ? (
                  gameHistory.map(game => (
                    <tr key={game.id} className="border-b border-border">
                      <td className="py-2 px-4 text-text-secondary">{formatTime(game.timestamp)}</td>
                      <td className="py-2 px-4 text-text-secondary">{formatCurrency(game.betAmount)}</td>
                      <td className="py-2 px-4 text-text-secondary">{game.mines}</td>
                      <td className="py-2 px-4 text-text-secondary">{game.revealedCount}</td>
                      <td className="py-2 px-4">
                        {game.hit ?
                          <span className="text-status-error">Mine Hit</span> :
                          <span className={getMultiplierColor(game.multiplier)}>
                            {game.multiplier?.toFixed(2)}x {game.cashOut ? '(Cash Out)' : ''}
                          </span>
                        }
                      </td>
                      <td className={`py-2 px-4 font-bold ${
                        game.profit >= 0 ? 'text-status-success' : 'text-status-error'
                      }`}>
                        {game.profit >= 0 ? '+' : ''}{formatCurrency(game.profit)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-text-muted">
                      No games played yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
        <div className="bg-bg-card border border-border rounded-xl p-5 mt-4">
          <h3 className="text-lg font-heading font-bold text-text-primary mb-3">Game Stats</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted">Games Played</div>
              <div className="text-lg font-heading font-bold text-text-primary">{gameHistory.length}</div>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted">Total Wagered</div>
              <div className="text-lg font-heading font-bold text-text-primary">
                {formatCurrency(gameHistory.reduce((sum, game) => sum + game.betAmount, 0))}
              </div>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted">Total Profit</div>
              <div className={`text-lg font-heading font-bold ${
                gameHistory.reduce((sum, game) => sum + game.profit, 0) >= 0
                  ? 'text-status-success'
                  : 'text-status-error'
              }`}>
                {formatCurrency(gameHistory.reduce((sum, game) => sum + game.profit, 0))}
              </div>
            </div>
            <div className="bg-bg-elevated rounded-lg p-3">
              <div className="text-xs text-text-muted">Best Win</div>
              <div className="text-lg font-heading font-bold text-status-success">
                {gameHistory.length > 0
                  ? formatCurrency(Math.max(0, ...gameHistory.map(g => g.profit)))
                  : formatCurrency(0)
                }
              </div>
            </div>
          </div>

          <div className="mt-4 bg-bg-elevated rounded-lg p-3">
            <div className="flex justify-between">
              <span className="text-text-muted">Balance</span>
              <span className="font-heading font-bold text-text-primary">{formatCurrency(balance)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandminesGame;
