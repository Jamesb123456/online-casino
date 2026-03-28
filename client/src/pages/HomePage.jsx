import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../layouts/MainLayout';

const HomePage = () => {
  useEffect(() => {
    document.title = 'Platinum Casino';
  }, []);

  // Featured games data with proper titles and images
  const featuredGames = [
    {
      id: 1,
      title: 'Crash',
      description: 'Watch the multiplier rise and cash out before it crashes!',
      path: '/games/crash',
      imageBg: 'bg-gradient-to-br from-game-crash/40 to-game-crash/10',
      accent: 'text-game-crash'
    },
    {
      id: 2,
      title: 'Roulette',
      description: 'Place your bets on red, black, or your lucky number!',
      path: '/games/roulette',
      imageBg: 'bg-gradient-to-br from-game-roulette/40 to-game-roulette/10',
      accent: 'text-game-roulette'
    },
    {
      id: 3,
      title: 'Blackjack',
      description: 'Beat the dealer with a hand value of 21 or less.',
      path: '/games/blackjack',
      imageBg: 'bg-gradient-to-br from-game-blackjack/40 to-game-blackjack/10',
      accent: 'text-game-blackjack'
    },
    {
      id: 4,
      title: 'Plinko',
      description: 'Drop the ball and watch it bounce for big wins!',
      path: '/games/plinko',
      imageBg: 'bg-gradient-to-br from-game-plinko/40 to-game-plinko/10',
      accent: 'text-game-plinko'
    },
  ];

  // All available games
  const allGames = [
    ...featuredGames,
    {
      id: 5,
      title: 'Wheel',
      description: 'Spin the wheel for a chance to win big prizes!',
      path: '/games/wheel',
      imageBg: 'bg-gradient-to-br from-game-wheel/40 to-game-wheel/10',
      accent: 'text-game-wheel'
    },
  ];

  return (
    <MainLayout>
      <div className="-mx-4 -mt-24 -mb-12">
        {/* Hero Section */}
        <div className="relative overflow-hidden bg-bg-base">
          {/* Gradient mesh background */}
          <div className="absolute inset-0">
            <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-accent-gold/5 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent-purple/5 rounded-full blur-[100px]"></div>
          </div>

          <div className="px-4 py-20 md:py-32 relative z-10">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-5xl md:text-7xl font-heading font-bold mb-6 animate-fade-in">
                <span className="text-gold-gradient">Platinum</span>{' '}
                <span className="text-text-primary">Casino</span>
              </h1>
              <p className="text-xl text-text-secondary mb-10 max-w-2xl mx-auto animate-slide-up">
                Experience the thrill of casino games from the comfort of your home.
                Play now and claim your welcome bonus!
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-up">
                <Link
                  to="/register"
                  className="px-8 py-3.5 bg-gradient-to-r from-accent-gold to-accent-gold-light text-bg-base font-bold rounded-lg shadow-glow-gold hover:shadow-glow-gold-lg transition-all duration-300"
                >
                  Sign Up Now
                </Link>
                <Link
                  to="/games"
                  className="glass px-8 py-3.5 text-text-primary font-bold rounded-lg hover:bg-white/10 transition-all duration-300"
                >
                  Browse Games
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Featured Games Section */}
        <div className="bg-bg-base py-20">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-heading font-bold text-text-primary mb-2">Featured Games</h2>
            <p className="text-text-secondary mb-10">Try our most popular casino games</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {featuredGames.map(game => (
                <Link key={game.id} to={game.path} className="group">
                  <div className="bg-bg-card rounded-xl overflow-hidden border border-border hover:-translate-y-1 hover:shadow-lg transition-all duration-300 cursor-pointer h-full flex flex-col">
                    {/* Game image area */}
                    <div className={`h-48 ${game.imageBg} flex items-center justify-center p-4`}>
                      <h3 className="text-3xl font-heading font-bold text-text-primary">{game.title}</h3>
                    </div>

                    {/* Game info */}
                    <div className="p-5 flex-grow flex flex-col">
                      <p className="text-text-secondary mb-4 flex-grow">{game.description}</p>
                      <span className="inline-block w-fit px-4 py-2 bg-accent-gold/15 text-accent-gold rounded-full text-sm font-medium group-hover:bg-accent-gold group-hover:text-bg-base transition-colors duration-200">
                        Play Now
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Why Choose Us Section */}
        <div className="bg-bg-card py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <h2 className="text-3xl font-heading font-bold text-text-primary mb-4">Why Choose Platinum Casino</h2>
              <p className="text-text-secondary">We offer the best online casino experience with secure payments and exciting bonuses</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="glass rounded-xl p-6">
                <div className="w-12 h-12 bg-accent-gold/15 text-accent-gold rounded-full flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <h3 className="text-xl font-heading font-bold text-text-primary mb-2">Secure & Fair</h3>
                <p className="text-text-secondary">All games are provably fair and your data is always protected with advanced encryption.</p>
              </div>

              <div className="glass rounded-xl p-6">
                <div className="w-12 h-12 bg-accent-gold/15 text-accent-gold rounded-full flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-heading font-bold text-text-primary mb-2">Fast Payouts</h3>
                <p className="text-text-secondary">Withdraw your winnings quickly with our streamlined payment processing system.</p>
              </div>

              <div className="glass rounded-xl p-6">
                <div className="w-12 h-12 bg-accent-gold/15 text-accent-gold rounded-full flex items-center justify-center mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-heading font-bold text-text-primary mb-2">24/7 Support</h3>
                <p className="text-text-secondary">Our customer support team is available around the clock to assist you with any issues.</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-accent-gold-dark via-accent-gold to-accent-gold-light py-14">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-heading font-bold text-bg-base mb-4">Ready to Play?</h2>
            <p className="text-bg-base/80 text-lg mb-8 max-w-2xl mx-auto">Join thousands of players and start winning today. Sign up now and claim your welcome bonus!</p>
            <Link
              to="/register"
              className="px-8 py-3.5 bg-bg-base hover:bg-bg-card text-text-primary font-bold rounded-lg transition-colors duration-200 inline-block"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default HomePage;
