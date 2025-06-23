import React from 'react';
import MainLayout from '../components/layouts/MainLayout';
import ChickenGame from '../games/chicken/ChickenGame';

const ChickenPage = () => {
  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Chicken Game</h1>
        <p className="text-gray-300 mb-6">
          Test your nerves in our exciting Chicken game! See how long you can let your multiplier grow before the bomb
          explodes. Cash out at the right time to maximize your profits, but wait too long and you'll lose everything!
        </p>
        
        <ChickenGame />
      </div>
    </MainLayout>
  );
};

export default ChickenPage;