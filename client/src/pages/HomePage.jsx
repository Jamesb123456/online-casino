import React from 'react';
import { Link } from 'react-router-dom';
import MainLayout from '../components/layouts/MainLayout';

const HomePage = () => {
  // Featured games data with proper titles and images
  const featuredGames = [
    { 
      id: 1, 
      title: 'Crash',
      description: 'Watch the multiplier rise and cash out before it crashes!',
      path: '/games/crash',
      imageBg: 'bg-gradient-to-br from-red-600 to-red-900'
    },
    { 
      id: 2, 
      title: 'Roulette',
      description: 'Place your bets on red, black, or your lucky number!',
      path: '/games/roulette',
      imageBg: 'bg-gradient-to-br from-green-600 to-green-900'
    },
    { 
      id: 3, 
      title: 'Blackjack',
      description: 'Beat the dealer with a hand value of 21 or less.',
      path: '/games/blackjack',
      imageBg: 'bg-gradient-to-br from-blue-600 to-blue-900'
    },
    { 
      id: 4, 
      title: 'Plinko',
      description: 'Drop the ball and watch it bounce for big wins!',
      path: '/games/plinko',
      imageBg: 'bg-gradient-to-br from-purple-600 to-purple-900'
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
      imageBg: 'bg-gradient-to-br from-yellow-500 to-yellow-700'
    },
    { 
      id: 6, 
      title: 'Chicken',
      description: 'Test your luck in this exciting game of chance!',
      path: '/games/chicken',
      imageBg: 'bg-gradient-to-br from-orange-500 to-orange-700'
    },
  ];
  
  return (
    <MainLayout>
      {/* Hero Section */}
      <div className="relative bg-gradient-to-b from-[#0f1923] to-[#1a2c3d] overflow-hidden">
        {/* Background pattern overlay */}
        <div className="absolute inset-0 opacity-10 bg-[url('/pattern.png')] bg-repeat"></div>
        
        <div className="container mx-auto px-4 py-16 md:py-24 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              <span className="text-[#ffc107]">Platinum Casino</span> - Play & Win
            </h1>
            <p className="text-xl text-gray-300 mb-8">
              Experience the thrill of casino games from the comfort of your home.
              Play now and claim your welcome bonus!
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                to="/register" 
                className="px-8 py-3 bg-[#ffc107] hover:bg-[#e6af06] text-gray-900 font-bold rounded-md transition-colors duration-200"
              >
                Sign Up Now
              </Link>
              <Link 
                to="/games" 
                className="px-8 py-3 bg-[#213749] hover:bg-[#2a4359] text-white font-bold rounded-md border border-[#2a4359] transition-colors duration-200"
              >
                Browse Games
              </Link>
            </div>
          </div>
        </div>
      </div>
      
      {/* Featured Games Section */}
      <div className="bg-[#0f1923] py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-white mb-2">Featured Games</h2>
          <p className="text-gray-400 mb-8">Try our most popular casino games</p>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredGames.map(game => (
              <Link key={game.id} to={game.path} className="group">
                <div className="bg-[#1a2c3d] rounded-lg overflow-hidden transition-transform duration-300 hover:transform hover:scale-105 hover:shadow-xl border border-[#2a3f52] h-full flex flex-col">
                  {/* Game image area */}
                  <div className={`h-48 ${game.imageBg} flex items-center justify-center p-4`}>
                    <h3 className="text-3xl font-bold text-white">{game.title}</h3>
                  </div>
                  
                  {/* Game info */}
                  <div className="p-4 flex-grow">
                    <p className="text-gray-300 mb-4">{game.description}</p>
                    <span className="inline-block px-4 py-2 bg-[#213749] text-[#ffc107] rounded text-sm font-medium group-hover:bg-[#ffc107] group-hover:text-gray-900 transition-colors duration-200">
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
      <div className="bg-[#1a2c3d] py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Why Choose Platinum Casino</h2>
            <p className="text-gray-300">We offer the best online casino experience with secure payments and exciting bonuses</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#213749] p-6 rounded-lg border border-[#2a4359]">
              <div className="w-12 h-12 bg-[#ffc107] rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Secure & Fair</h3>
              <p className="text-gray-300">All games are provably fair and your data is always protected with advanced encryption.</p>
            </div>
            
            <div className="bg-[#213749] p-6 rounded-lg border border-[#2a4359]">
              <div className="w-12 h-12 bg-[#ffc107] rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Fast Payouts</h3>
              <p className="text-gray-300">Withdraw your winnings quickly with our streamlined payment processing system.</p>
            </div>
            
            <div className="bg-[#213749] p-6 rounded-lg border border-[#2a4359]">
              <div className="w-12 h-12 bg-[#ffc107] rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-900" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">24/7 Support</h3>
              <p className="text-gray-300">Our customer support team is available around the clock to assist you with any issues.</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* CTA Section */}
      <div className="bg-gradient-to-r from-[#ffc107] to-[#ff9800] py-12">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Ready to Play?</h2>
          <p className="text-gray-800 text-lg mb-6 max-w-2xl mx-auto">Join thousands of players and start winning today. Sign up now and claim your welcome bonus!</p>
          <Link 
            to="/register" 
            className="px-8 py-3 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-md transition-colors duration-200 inline-block"
          >
            Create Account
          </Link>
        </div>
      </div>
    </MainLayout>
  );
};

export default HomePage;