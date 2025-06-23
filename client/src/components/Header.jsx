import React, { useState, useEffect, useContext } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useContext(AuthContext);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 10) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Close mobile menu when changing routes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/');
  };
  
  // Get user balance from auth context
  const userBalance = user ? user.balance.toLocaleString() : "0";

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled 
        ? 'bg-bg-elevated bg-opacity-95 backdrop-blur-sm shadow-md py-2' 
        : 'bg-transparent py-4'
    }`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <div className="text-2xl font-bold bg-gradient-primary text-transparent bg-clip-text mr-1">
                Virtual
              </div>
              <div className="text-2xl font-bold bg-gradient-accent text-transparent bg-clip-text">
                Casino
              </div>
            </Link>
          </div>
          
          {/* Balance indicator (desktop) */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center bg-bg-elevated rounded-full px-4 py-1.5 border border-accent border-opacity-30 shadow-glow mr-4">
              <div className="flex items-center">
                <span className="text-accent-light font-medium mr-1.5">₵</span>
                <span className="text-white font-bold">{userBalance}</span>
              </div>
              <button className="ml-3 bg-accent hover:bg-accent-dark text-white text-xs font-bold px-2 py-0.5 rounded-md transition-colors">
                +
              </button>
            </div>
          )}
          
          {/* Mobile menu button */}
          <div className="md:hidden">
            <button 
              onClick={toggleMenu}
              className="text-white hover:text-accent focus:outline-none"
              aria-label="Toggle menu"
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
          <nav className="hidden md:flex items-center space-x-1">
            <NavLink to="/" label="Home" />
            <NavLink to="/games" label="Games" />
            {/* <NavLink to="/leaderboard" label="Leaderboard" /> */}
            
            {isAuthenticated ? (
              <>
                <NavLink to="/profile" label={`Profile${user ? ` (${user.username})` : ''}`} />
                {user && user.role === 'admin' && (
                  <NavLink to="/admin/dashboard" label="Admin" />
                )}
                <button 
                  onClick={handleLogout}
                  className="ml-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="flex items-center ml-2 space-x-3">
                <Link to="/login" className="text-white hover:text-accent transition-colors">
                  Login
                </Link>
                <Link to="/register" className="bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-md font-medium transition-colors">
                  Register
                </Link>
              </div>
            )}
          </nav>
        </div>
        
        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="mt-4 pt-4 border-t border-gray-700 md:hidden">
            <div className="flex flex-col space-y-4 pb-4">
              <MobileNavLink to="/" label="Home" />
              <MobileNavLink to="/games" label="Games" />
              <MobileNavLink to="/leaderboard" label="Leaderboard" />
              
              {/* Mobile balance display */}
              {isAuthenticated && (
                <div className="flex items-center justify-between bg-bg-elevated rounded-lg px-3 py-2 border border-accent-light border-opacity-20 my-1">
                  <div className="flex items-center">
                    <span className="text-accent font-medium mr-1">Balance:</span>
                    <span className="text-white font-bold">₵ {userBalance}</span>
                  </div>
                  <button className="bg-accent hover:bg-accent-dark text-white text-xs font-bold px-2 py-1 rounded-md transition-colors">
                    Add Funds
                  </button>
                </div>
              )}
              
              {isAuthenticated ? (
                <>
                  <MobileNavLink to="/profile" label={`Profile${user ? ` (${user.username})` : ''}`} />
                  {user && user.role === 'admin' && (
                    <MobileNavLink to="/admin/dashboard" label="Admin Dashboard" />
                  )}
                  <button 
                    onClick={handleLogout}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md text-center transition-colors"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <div className="flex flex-col space-y-2">
                  <Link to="/login" className="bg-bg-elevated hover:bg-bg-card text-white px-4 py-2 rounded-md text-center transition-colors">
                    Login
                  </Link>
                  <Link to="/register" className="bg-accent hover:bg-accent-dark text-white px-4 py-2 rounded-md text-center font-medium transition-colors">
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

// Desktop nav link with active state
const NavLink = ({ to, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to || 
    (to !== '/' && location.pathname.startsWith(to));
  
  return (
    <Link 
      to={to}
      className={`px-3 py-2 rounded-md transition-colors ${
        isActive 
          ? 'bg-primary text-white font-medium' 
          : 'text-gray-300 hover:bg-bg-elevated hover:text-white'
      }`}
    >
      {label}
    </Link>
  );
};

// Mobile nav link with active state
const MobileNavLink = ({ to, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to || 
    (to !== '/' && location.pathname.startsWith(to));
  
  return (
    <Link 
      to={to}
      className={`px-3 py-2 rounded-md transition-colors ${
        isActive 
          ? 'bg-primary text-white font-medium' 
          : 'text-gray-300 hover:bg-bg-elevated hover:text-white'
      }`}
    >
      {label}
    </Link>
  );
};

export default Header;