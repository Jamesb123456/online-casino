import React, { useEffect } from 'react';
import MainLayout from '../../layouts/MainLayout';
import RouletteGame from '../../games/roulette/RouletteGame';

const RoulettePage = () => {
  useEffect(() => {
    document.title = 'Roulette | Platinum Casino';
  }, []);
  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Roulette</h1>
        <p className="text-gray-400">
          Place your bets and try your luck on our European Roulette table with 37 pockets.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Multiple bet types with different payout ratios. Inside bets offer higher payouts but lower odds of winning, while outside bets give better chances with lower payouts.
        </p>
      </div>
      
      <RouletteGame />
      
      <div className="mt-12 bg-[#1a2c3d] rounded-lg p-6 border border-[#2a3f52]">
        <h2 className="text-xl font-bold mb-4">How to Play</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-300">
          <li><span className="text-[#ffc107] font-semibold">Select Bet Type</span> - Choose from inside or outside bets</li>
          <li><span className="text-[#ffc107] font-semibold">Select Value</span> - For some bet types, select specific numbers or ranges</li>
          <li><span className="text-[#ffc107] font-semibold">Set Bet Amount</span> - Decide how much to wager</li>
          <li><span className="text-[#ffc107] font-semibold">Place Bets</span> - Add one or more bets to the table</li>
          <li><span className="text-[#ffc107] font-semibold">Spin the Wheel</span> - Once all bets are placed, spin the wheel</li>
          <li><span className="text-[#ffc107] font-semibold">Collect Winnings</span> - Winnings are automatically added to your balance</li>
        </ol>
        
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-2">Bet Types</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-[#213749] p-4 rounded border border-[#2a4359]">
              <div className="text-[#ffc107] font-bold mb-1">Inside Bets</div>
              <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                <li>Straight: Bet on a single number (35:1)</li>
              </ul>
            </div>
            <div className="bg-[#213749] p-4 rounded border border-[#2a4359]">
              <div className="text-[#ffc107] font-bold mb-1">Outside Bets</div>
              <ul className="text-sm text-gray-300 space-y-1 list-disc list-inside">
                <li>Red/Black: Bet on all red or black numbers (1:1)</li>
                <li>Odd/Even: Bet on all odd or even numbers (1:1)</li>
                <li>Low/High: Bet on numbers 1-18 or 19-36 (1:1)</li>
                <li>Dozen: Bet on 12 numbers (2:1)</li>
                <li>Column: Bet on 12 numbers in a column (2:1)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default RoulettePage;