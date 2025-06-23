import React, { useState } from 'react';
import { formatCurrency } from './blackjackUtils';

/**
 * BlackjackBettingPanel Component
 * Handles betting and game action buttons for blackjack
 */
const BlackjackBettingPanel = ({
  balance = 0,
  gameState = 'betting', // betting, playing, dealerTurn, gameOver
  onPlaceBet,
  onHit,
  onStand,
  onDouble,
  onNewGame
}) => {
  const [betAmount, setBetAmount] = useState(10);
  const betOptions = [10, 25, 50, 100, 500];
  
  // Handle bet amount input change
  const handleBetChange = (e) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value > 0 && value <= balance) {
      setBetAmount(value);
    }
  };
  
  // Handle bet submission
  const handlePlaceBet = () => {
    if (betAmount > 0 && betAmount <= balance) {
      onPlaceBet(betAmount);
    }
  };
  
  // Handle quick bet selection
  const handleQuickBet = (amount) => {
    if (amount <= balance) {
      setBetAmount(amount);
    }
  };
  
  return (
    <div className="bg-gray-800 p-5 rounded-lg shadow-lg">
      <div className="mb-4">
        <h3 className="text-lg text-white font-semibold mb-1">Your Balance</h3>
        <div className="text-2xl text-green-400 font-bold">{formatCurrency(balance)}</div>
      </div>
      
      {gameState === 'betting' && (
        <>
          <div className="mb-4">
            <h3 className="text-lg text-white font-semibold mb-1">Place Your Bet</h3>
            <div className="flex items-center">
              <input
                type="number"
                value={betAmount}
                onChange={handleBetChange}
                min="1"
                max={balance}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
          
          <div className="mb-4">
            <h3 className="text-sm text-gray-300 mb-2">Quick Bet</h3>
            <div className="grid grid-cols-5 gap-2">
              {betOptions.map(option => (
                <button
                  key={option}
                  onClick={() => handleQuickBet(option)}
                  disabled={option > balance}
                  className={`px-2 py-1 rounded-md ${
                    betAmount === option 
                      ? 'bg-purple-600 text-white' 
                      : option <= balance 
                        ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                        : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                  }`}
                >
                  {formatCurrency(option)}
                </button>
              ))}
            </div>
          </div>
          
          <button
            onClick={handlePlaceBet}
            disabled={betAmount <= 0 || betAmount > balance}
            className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-bold disabled:opacity-50"
          >
            Deal Cards
          </button>
        </>
      )}
      
      {gameState === 'playing' && (
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onHit}
            className="py-3 bg-green-600 hover:bg-green-700 text-white rounded-md font-bold"
          >
            Hit
          </button>
          
          <button
            onClick={onStand}
            className="py-3 bg-red-600 hover:bg-red-700 text-white rounded-md font-bold"
          >
            Stand
          </button>
          
          <button
            onClick={onDouble}
            className="py-3 col-span-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-bold"
          >
            Double Down
          </button>
        </div>
      )}
      
      {(gameState === 'dealerTurn' || gameState === 'gameOver') && (
        <div className="mt-4">
          {gameState === 'dealerTurn' && (
            <div className="bg-gray-700 p-3 rounded-md text-center mb-4">
              <p className="text-white">Dealer's turn...</p>
            </div>
          )}
          
          {gameState === 'gameOver' && (
            <button
              onClick={onNewGame}
              className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-bold"
            >
              New Hand
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default BlackjackBettingPanel;