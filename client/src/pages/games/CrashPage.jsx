import React, { useState, useEffect } from 'react';
import MainLayout from '../../layouts/MainLayout';
import CrashGame from '../../games/crash/CrashGame';
import ApiStatus from '../../components/ui/ApiStatus';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';

const CrashPage = () => {
  useEffect(() => {
    document.title = 'Crash | Platinum Casino';
  }, []);
  const [gameStatus, setGameStatus] = useState({
    status: 'loading',
    error: null
  });

  useEffect(() => {
    // Simulate game loading
    const timer = setTimeout(() => {
      setGameStatus({
        status: 'success',
        error: null
      });
    }, 1000);
    
    // Handle any connection errors
    return () => clearTimeout(timer);
  }, []);

  return (
    <MainLayout>
      <div className="mb-10 text-center">
        <div className="flex items-center justify-center mb-3">
          <Badge variant="danger" size="md" className="mr-3">LIVE</Badge>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-gray-400 text-transparent bg-clip-text">
            Crash Game
          </h1>
        </div>
        <p className="text-gray-300 max-w-2xl mx-auto">
          Watch the multiplier go up until it crashes. Cash out before it's too late!
        </p>
        <p className="text-sm text-gray-400 mt-2 max-w-2xl mx-auto">
          Place your bet, set an auto cash-out point, or manually cash out at any time. 
          The longer you wait, the higher your potential winnings, but wait too long and you might lose everything!
        </p>
      </div>
      
      <div className="mb-10">
        <ApiStatus 
          status={gameStatus.status}
          error={gameStatus.error}
          loadingMessage="Loading Crash Game..."
          errorMessage="Could not connect to game server"
        >
          <CrashGame />
        </ApiStatus>
      </div>
      
      <Card 
        variant="elevated" 
        title="How to Play"
        className="mt-12 border-l-4 border-game-crash"
      >
        <ol className="list-decimal list-inside space-y-3 text-gray-300">
          <li className="p-2 hover:bg-bg-elevated rounded-md transition-colors">
            <span className="text-game-crash font-semibold">Place Your Bet</span> - Enter how much you want to wager
          </li>
          <li className="p-2 hover:bg-bg-elevated rounded-md transition-colors">
            <span className="text-game-crash font-semibold">Set Auto Cashout</span> - Choose a multiplier to automatically cash out
          </li>
          <li className="p-2 hover:bg-bg-elevated rounded-md transition-colors">
            <span className="text-game-crash font-semibold">Watch the Multiplier</span> - See the multiplier increase in real-time
          </li>
          <li className="p-2 hover:bg-bg-elevated rounded-md transition-colors">
            <span className="text-game-crash font-semibold">Cash Out</span> - Hit the cash out button before the game crashes
          </li>
          <li className="p-2 hover:bg-bg-elevated rounded-md transition-colors">
            <span className="text-game-crash font-semibold">Collect Winnings</span> - Get your original bet multiplied by the cash out value
          </li>
        </ol>
        
        <div className="mt-6 p-4 bg-game-crash/10 rounded-lg border border-game-crash/20">
          <h3 className="text-lg font-semibold mb-2">Game Strategy</h3>
          <p className="text-gray-300">
            The optimal strategy often involves setting an auto-cashout at a specific multiplier value that balances risk and reward. 
            Remember that the house edge is built into the game mechanics, so while you can win big on individual rounds, the odds favor the house over time.
          </p>
        </div>
      </Card>
    </MainLayout>
  );
};

export default CrashPage;