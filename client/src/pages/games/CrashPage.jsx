import React from 'react';
import MainLayout from '../../layouts/MainLayout';
import CrashGame from '../../games/crash/CrashGame';

const CrashPage = () => {
  return (
    <MainLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Crash Game</h1>
        <p className="text-gray-400">
          Watch the multiplier go up until it crashes. Cash out before it's too late!
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Place your bet, set an auto cash-out point, or manually cash out at any time. 
          The longer you wait, the higher your potential winnings, but wait too long and you might lose everything!
        </p>
      </div>
      
      <CrashGame />
      
      <div className="mt-12 bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">How to Play</h2>
        <ol className="list-decimal list-inside space-y-2 text-gray-300">
          <li><span className="text-amber-400 font-semibold">Place Your Bet</span> - Enter how much you want to wager</li>
          <li><span className="text-amber-400 font-semibold">Set Auto Cashout</span> - Choose a multiplier to automatically cash out</li>
          <li><span className="text-amber-400 font-semibold">Watch the Multiplier</span> - See the multiplier increase in real-time</li>
          <li><span className="text-amber-400 font-semibold">Cash Out</span> - Hit the cash out button before the game crashes</li>
          <li><span className="text-amber-400 font-semibold">Collect Winnings</span> - Get your original bet multiplied by the cash out value</li>
        </ol>
      </div>
    </MainLayout>
  );
};

export default CrashPage;