import React, { useEffect } from 'react';
import MainLayout from '../../layouts/MainLayout';
import LandminesGame from '../../games/landmines/LandminesGame';

const LandminesPage = () => {
  useEffect(() => {
    document.title = 'Landmines | Platinum Casino';
  }, []);
  return (
    <MainLayout>
      <div className="mb-6 mt-4">
        <h1 className="text-3xl font-bold mb-6">Landmines Game</h1>
        <div className="mb-6">
          <p className="text-gray-300">
            Find diamonds and avoid mines in this thrilling game of chance!
            Choose your bet and number of mines - the more mines, the higher the potential reward.
            Cash out anytime or push your luck for bigger wins.
          </p>
        </div>
        <LandminesGame />
      </div>
    </MainLayout>
  );
};

export default LandminesPage;
