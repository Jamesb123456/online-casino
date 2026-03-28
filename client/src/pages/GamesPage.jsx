import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';
import Card from '../components/ui/Card';

const GamesPage = () => {
  useEffect(() => {
    document.title = 'Games | Platinum Casino';
  }, []);
  const games = [
    {
      id: 'crash',
      name: 'Crash',
      description: 'Watch the multiplier increase until it crashes. Cash out before it\'s too late!',
      bgColor: 'bg-gradient-to-br from-game-crash/30 to-bg-card',
      accentColor: 'border-game-crash',
      buttonColor: 'bg-game-crash/15 text-game-crash hover:bg-game-crash hover:text-bg-base'
    },
    {
      id: 'plinko',
      name: 'Plinko',
      description: 'Drop the ball and watch it bounce through pins to determine your payout.',
      bgColor: 'bg-gradient-to-br from-game-plinko/30 to-bg-card',
      accentColor: 'border-game-plinko',
      buttonColor: 'bg-game-plinko/15 text-game-plinko hover:bg-game-plinko hover:text-bg-base'
    },
    {
      id: 'wheel',
      name: 'Wheel',
      description: 'Spin the wheel and win based on where it stops!',
      bgColor: 'bg-gradient-to-br from-game-wheel/30 to-bg-card',
      accentColor: 'border-game-wheel',
      buttonColor: 'bg-game-wheel/15 text-game-wheel hover:bg-game-wheel hover:text-bg-base'
    },
    {
      id: 'roulette',
      name: 'Roulette',
      description: 'Classic casino roulette with multiple betting options.',
      bgColor: 'bg-gradient-to-br from-game-roulette/30 to-bg-card',
      accentColor: 'border-game-roulette',
      buttonColor: 'bg-game-roulette/15 text-game-roulette hover:bg-game-roulette hover:text-bg-base'
    },

    {
      id: 'blackjack',
      name: 'Blackjack',
      description: 'Beat the dealer by getting closer to 21 without going over.',
      bgColor: 'bg-gradient-to-br from-game-blackjack/30 to-bg-card',
      accentColor: 'border-game-blackjack',
      buttonColor: 'bg-game-blackjack/15 text-game-blackjack hover:bg-game-blackjack hover:text-bg-base'
    },
    {
      id: 'landmines',
      name: 'Landmines',
      description: 'Find diamonds and avoid mines for increasing rewards. Cash out anytime!',
      bgColor: 'bg-gradient-to-br from-game-landmines/30 to-bg-card',
      accentColor: 'border-game-landmines',
      buttonColor: 'bg-game-landmines/15 text-game-landmines hover:bg-game-landmines hover:text-bg-base'
    }
  ];

  return (
    <MainLayout>
      <div className="mb-12 mt-6 text-center">
        <h1 className="text-5xl font-heading font-bold mb-4">
          <span className="text-gold-gradient">Our Games</span>
        </h1>
        <p className="text-text-secondary text-lg max-w-2xl mx-auto">
          Experience the thrill of casino games with our selection of exciting options.
          All games use virtual currency - no real money at stake!
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {games.map(game => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </MainLayout>
  );
};

const GameCard = ({ game }) => {
  return (
    <div className="bg-bg-card border border-border rounded-xl overflow-hidden hover:-translate-y-1 transition-all duration-200 cursor-pointer group">
      <div className={`h-52 ${game.bgColor} flex items-center justify-center relative overflow-hidden`}>
        <div className={`flex items-center justify-center w-24 h-24 rounded-full relative z-10 ${game.accentColor} border-2 bg-bg-elevated/50`}>
          <span className="text-2xl font-heading font-bold text-text-primary">{game.name}</span>
        </div>
      </div>
      <div className="p-6">
        <h2 className="text-2xl font-heading font-bold mb-3 text-text-primary">
          {game.name}
        </h2>
        <p className="text-text-secondary mb-6 h-12">{game.description}</p>
        <Link
          to={`/games/${game.id}`}
          className={`block text-center ${game.buttonColor} py-3 px-6 rounded-lg font-medium transition-all duration-200`}
        >
          Play Now
        </Link>
      </div>
    </div>
  );
};

export default GamesPage;
