import React, { useState } from 'react';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false); // This will be replaced with actual auth state

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="bg-gray-800 py-4">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-amber-500">Virtual Casino</h1>
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden">
            <button 
              onClick={toggleMenu}
              className="text-gray-300 hover:text-white focus:outline-none"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            <a href="/" className="text-gray-300 hover:text-white">Home</a>
            <a href="/games" className="text-gray-300 hover:text-white">Games</a>
            <a href="/leaderboard" className="text-gray-300 hover:text-white">Leaderboard</a>
            {isLoggedIn ? (
              <>
                <a href="/profile" className="text-gray-300 hover:text-white">Profile</a>
                <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">
                  Logout
                </button>
              </>
            ) : (
              <div className="flex space-x-4">
                <a href="/login" className="text-gray-300 hover:text-white">Login</a>
                <a href="/register" className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded">
                  Register
                </a>
              </div>
            )}
          </nav>
        </div>
        
        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="mt-4 md:hidden">
            <div className="flex flex-col space-y-4">
              <a href="/" className="text-gray-300 hover:text-white">Home</a>
              <a href="/games" className="text-gray-300 hover:text-white">Games</a>
              <a href="/leaderboard" className="text-gray-300 hover:text-white">Leaderboard</a>
              {isLoggedIn ? (
                <>
                  <a href="/profile" className="text-gray-300 hover:text-white">Profile</a>
                  <button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded">
                    Logout
                  </button>
                </>
              ) : (
                <div className="flex flex-col space-y-2">
                  <a href="/login" className="text-gray-300 hover:text-white">Login</a>
                  <a href="/register" className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded text-center">
                    Register
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;