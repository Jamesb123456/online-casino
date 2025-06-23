import React, { useState, useEffect } from 'react';
import Button from '../../components/ui/Button';
import { DIFFICULTY_LEVELS, getAutoCashOutOptions, formatMultiplier } from './chickenUtils';

const BET_PRESET_AMOUNTS = [5, 10, 25, 50, 100];

const ChickenBettingPanel = ({
  balance = 0,
  onPlaceBet,
  onCashOut,
  isPlaying = false,
  isWaiting = false,
  currentMultiplier = 1,
  gameHistory = [],
  lastResult = null,
}) => {
  // Betting state
  const [betAmount, setBetAmount] = useState(10);
  const [autoCashOutMultiplier, setAutoCashOutMultiplier] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('medium');
  const [potentialWinnings, setPotentialWinnings] = useState(0);
  
  // Get difficulty information
  const selectedDifficultyInfo = DIFFICULTY_LEVELS.find(d => d.id === selectedDifficulty);

  // Calculate potential winnings based on current bet and auto cash out value
  useEffect(() => {
    if (autoCashOutMultiplier && !isNaN(autoCashOutMultiplier)) {
      const cashOutValue = parseFloat(autoCashOutMultiplier);
      if (cashOutValue >= 1.1) {
        const winnings = betAmount * cashOutValue;
        setPotentialWinnings(Math.floor(winnings * 100) / 100);
      }
    }
  }, [betAmount, autoCashOutMultiplier]);
  
  // Handle bet amount input
  const handleBetAmountChange = (e) => {
    const value = e.target.value;
    if (value === '' || !isNaN(value)) {
      setBetAmount(value === '' ? '' : parseFloat(value));
    }
  };
  
  // Handle bet amount validation and constraints
  const validateAndSetBetAmount = () => {
    let validAmount = betAmount;
    
    if (validAmount === '' || isNaN(validAmount)) {
      validAmount = 10; // Default amount
    } else {
      validAmount = Math.max(1, Math.min(validAmount, balance));
    }
    
    setBetAmount(validAmount);
  };
  
  // Handle auto cash out input
  const handleAutoCashOutChange = (e) => {
    const value = e.target.value;
    if (value === '' || (!isNaN(value) && parseFloat(value) >= 1.0)) {
      setAutoCashOutMultiplier(value);
    }
  };
  
  // Handle preset bet amount selection
  const handlePresetBetAmount = (amount) => {
    if (amount <= balance) {
      setBetAmount(amount);
    }
  };
  
  // Handle preset auto cash out selection
  const handlePresetAutoCashOut = (multiplier) => {
    setAutoCashOutMultiplier(multiplier.toString());
  };
  
  // Handle difficulty selection
  const handleDifficultyChange = (difficultyId) => {
    setSelectedDifficulty(difficultyId);
  };
  
  // Place bet with validation
  const handlePlaceBet = () => {
    validateAndSetBetAmount();
    
    const validBetAmount = typeof betAmount === 'number' ? betAmount : parseFloat(betAmount || 10);
    const validCashOut = autoCashOutMultiplier ? parseFloat(autoCashOutMultiplier) : null;
    
    if (validBetAmount <= 0 || validBetAmount > balance) {
      return; // Invalid bet amount
    }
    
    if (validCashOut !== null && (isNaN(validCashOut) || validCashOut < 1.1)) {
      return; // Invalid cash out multiplier
    }
    
    onPlaceBet({
      amount: validBetAmount,
      autoCashOut: validCashOut,
      difficulty: selectedDifficulty
    });
  };
  
  // Handle manual cash out
  const handleManualCashOut = () => {
    if (isPlaying && !isWaiting) {
      onCashOut();
    }
  };
  
  return (
    <div className="bg-gray-800 rounded-lg p-4 flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bet Amount Section */}
        <div className="bg-gray-700 p-3 rounded-md">
          <h3 className="text-white font-semibold mb-2">Bet Amount</h3>
          <div className="flex gap-2 mb-2">
            <input
              type="number"
              min="1"
              max={balance}
              value={betAmount}
              onChange={handleBetAmountChange}
              onBlur={validateAndSetBetAmount}
              className="w-full bg-gray-800 text-white p-2 rounded border border-gray-600"
              disabled={isPlaying || isWaiting}
            />
          </div>
          
          <div className="flex flex-wrap gap-2 mb-1">
            {BET_PRESET_AMOUNTS.map((amount) => (
              <button
                key={amount}
                onClick={() => handlePresetBetAmount(amount)}
                className={`px-2 py-1 rounded text-sm ${
                  betAmount === amount 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-600 text-gray-200'
                } ${(isPlaying || isWaiting || amount > balance) ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isPlaying || isWaiting || amount > balance}
              >
                {amount}
              </button>
            ))}
          </div>
          
          <div className="flex justify-between mt-2">
            <button
              onClick={() => handlePresetBetAmount(Math.max(1, (typeof betAmount === 'number' ? betAmount : 0) / 2))}
              className="px-2 py-1 bg-gray-600 rounded text-xs"
              disabled={isPlaying || isWaiting}
            >
              ½
            </button>
            <button
              onClick={() => handlePresetBetAmount(Math.min(balance, (typeof betAmount === 'number' ? betAmount : 0) * 2))}
              className="px-2 py-1 bg-gray-600 rounded text-xs"
              disabled={isPlaying || isWaiting}
            >
              2×
            </button>
            <button
              onClick={() => handlePresetBetAmount(Math.min(balance, balance))}
              className="px-2 py-1 bg-gray-600 rounded text-xs"
              disabled={isPlaying || isWaiting}
            >
              Max
            </button>
          </div>
        </div>
        
        {/* Auto Cash Out Section */}
        <div className="bg-gray-700 p-3 rounded-md">
          <h3 className="text-white font-semibold mb-2">Auto Cash Out</h3>
          <div className="flex gap-2 mb-2">
            <input
              type="number"
              min="1.1"
              step="0.1"
              value={autoCashOutMultiplier}
              onChange={handleAutoCashOutChange}
              placeholder="Auto cash out at..."
              className="w-full bg-gray-800 text-white p-2 rounded border border-gray-600"
              disabled={isPlaying || isWaiting}
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            {getAutoCashOutOptions().map((multiplier) => (
              <button
                key={multiplier}
                onClick={() => handlePresetAutoCashOut(multiplier)}
                className={`px-2 py-1 rounded text-sm ${
                  parseFloat(autoCashOutMultiplier) === multiplier 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-600 text-gray-200'
                } ${(isPlaying || isWaiting) ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={isPlaying || isWaiting}
              >
                {multiplier}x
              </button>
            ))}
          </div>
          
          {autoCashOutMultiplier && !isNaN(autoCashOutMultiplier) && (
            <div className="mt-2 text-sm text-green-400">
              Potential win: {potentialWinnings.toFixed(2)}
            </div>
          )}
        </div>
      </div>
      
      {/* Difficulty Selection */}
      <div className="bg-gray-700 p-3 rounded-md">
        <h3 className="text-white font-semibold mb-2">Difficulty</h3>
        <div className="grid grid-cols-3 gap-2">
          {DIFFICULTY_LEVELS.map((difficulty) => (
            <button
              key={difficulty.id}
              onClick={() => handleDifficultyChange(difficulty.id)}
              className={`p-2 rounded text-center ${
                selectedDifficulty === difficulty.id
                  ? `bg-${difficulty.color}-600 text-white`
                  : 'bg-gray-600 text-gray-200'
              } ${(isPlaying || isWaiting) ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isPlaying || isWaiting}
            >
              <div className="font-medium">{difficulty.name}</div>
              <div className="text-xs opacity-80">Max: {difficulty.maxMultiplier}x</div>
            </button>
          ))}
        </div>
        <div className="mt-2 text-sm text-gray-300">
          {selectedDifficultyInfo?.description || ''}
        </div>
      </div>
      
      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant={isPlaying ? "danger" : "primary"}
          onClick={isPlaying ? handleManualCashOut : handlePlaceBet}
          disabled={isWaiting || (!isPlaying && (!betAmount || betAmount <= 0 || betAmount > balance))}
          className="w-full py-3 text-lg font-bold"
        >
          {isPlaying ? 'CASH OUT!' : 'START GAME'}
        </Button>
        
        <div className="bg-gray-700 p-3 rounded-md flex flex-col justify-center items-center">
          <div className="text-lg font-bold">
            {isPlaying ? (
              <span className={currentMultiplier >= 2 ? 'text-green-400' : 'text-white'}>
                {formatMultiplier(currentMultiplier)}
              </span>
            ) : (
              <span className="text-white">Ready</span>
            )}
          </div>
          
          <div className="text-sm text-gray-300">
            {isPlaying ? 'Current Multiplier' : 'Place your bet'}
          </div>
        </div>
      </div>
      
      {/* Last Results */}
      {lastResult && (
        <div className={`mt-2 p-3 rounded-md ${
          lastResult.profit > 0 ? 'bg-green-800/30' : 'bg-red-800/30'
        }`}>
          <div className="flex justify-between">
            <span>Last game:</span>
            <span className={lastResult.profit > 0 ? 'text-green-400' : 'text-red-400'}>
              {lastResult.profit > 0 ? '+' : ''}{lastResult.profit.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-sm opacity-80">
            <span>Cashout: {lastResult.cashOutMultiplier ? formatMultiplier(lastResult.cashOutMultiplier) : 'N/A'}</span>
            <span>Crash: {formatMultiplier(lastResult.crashPoint)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChickenBettingPanel;