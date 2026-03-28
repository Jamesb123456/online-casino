import React, { useState, useEffect, useContext } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AuthContext } from '../contexts/AuthContext';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useContext(AuthContext);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu when changing routes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const toggleMenu = () => {
    setIsMenuOpen((prev) => !prev);
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Get user balance from auth context
  const userBalance = user?.balance?.toLocaleString() || '0';

  // Desktop nav link style helper
  const desktopLinkClass = ({ isActive }) =>
    `px-3 py-2 text-sm font-medium transition-colors duration-200 border-b-2 ${
      isActive
        ? 'text-accent-gold border-accent-gold'
        : 'text-text-secondary hover:text-accent-gold border-transparent'
    }`;

  // Mobile nav link style helper
  const mobileLinkClass = ({ isActive }) =>
    `block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
      isActive
        ? 'text-accent-gold bg-accent-gold/10'
        : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
    }`;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 glass border-b border-white/10 transition-shadow duration-300 ${
        scrolled ? 'shadow-card' : ''
      }`}
    >
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-1 shrink-0">
            <span className="text-xl font-bold font-heading text-gold-gradient">
              Platinum
            </span>
            <span className="text-xl font-bold font-heading text-text-primary">
              Casino
            </span>
          </Link>

          {/* Desktop navigation */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
            <NavLink to="/" end className={desktopLinkClass}>
              Home
            </NavLink>
            <NavLink to="/games" className={desktopLinkClass}>
              Games
            </NavLink>
            <NavLink to="/rewards" className={desktopLinkClass}>
              Rewards
            </NavLink>
            <NavLink to="/leaderboard" className={desktopLinkClass}>
              Leaderboard
            </NavLink>
          </nav>

          {/* Right side: balance + auth */}
          <div className="flex items-center gap-3">
            {/* Balance display (desktop) */}
            {isAuthenticated && (
              <div className="hidden md:flex items-center gap-2 bg-bg-elevated/60 backdrop-blur-sm rounded-full px-4 py-1.5 border border-accent-gold/20">
                {/* Gold chip icon */}
                <svg
                  className="w-5 h-5 text-accent-gold shrink-0"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
                  <text
                    x="12"
                    y="16"
                    textAnchor="middle"
                    fill="currentColor"
                    fontSize="12"
                    fontWeight="bold"
                    fontFamily="sans-serif"
                  >
                    $
                  </text>
                </svg>
                <span className="text-accent-gold font-bold font-heading text-sm">
                  {userBalance}
                </span>
              </div>
            )}

            {/* Desktop auth buttons */}
            <div className="hidden lg:flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  <NavLink
                    to="/profile"
                    className={desktopLinkClass}
                  >
                    {user ? user.username : 'Profile'}
                  </NavLink>
                  {user && user.role === 'admin' && (
                    <NavLink to="/admin/dashboard" className={desktopLinkClass}>
                      Admin
                    </NavLink>
                  )}
                  <button
                    onClick={handleLogout}
                    className="ml-1 px-4 py-1.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30 transition-colors duration-200"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-1.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary border border-border-light hover:border-text-muted transition-colors duration-200"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-1.5 rounded-lg text-sm font-medium bg-accent-gold hover:bg-accent-gold-dark text-bg-base font-heading transition-colors duration-200"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              onClick={toggleMenu}
              className="lg:hidden p-2 text-text-secondary hover:text-accent-gold transition-colors duration-200"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                {isMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile navigation dropdown */}
      {isMenuOpen && (
        <nav
          className="lg:hidden glass border-t border-white/10 animate-slide-up"
          aria-label="Mobile navigation"
        >
          <div className="container mx-auto px-4 py-4 max-w-7xl space-y-1">
            <NavLink to="/" end className={mobileLinkClass}>
              Home
            </NavLink>
            <NavLink to="/games" className={mobileLinkClass}>
              Games
            </NavLink>
            <NavLink to="/rewards" className={mobileLinkClass}>
              Rewards
            </NavLink>
            <NavLink to="/leaderboard" className={mobileLinkClass}>
              Leaderboard
            </NavLink>

            {/* Mobile balance display */}
            {isAuthenticated && (
              <div className="flex items-center justify-between bg-bg-elevated/60 rounded-lg px-4 py-2.5 border border-accent-gold/20 my-2">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-accent-gold"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="currentColor" fillOpacity="0.15" />
                    <text
                      x="12"
                      y="16"
                      textAnchor="middle"
                      fill="currentColor"
                      fontSize="12"
                      fontWeight="bold"
                      fontFamily="sans-serif"
                    >
                      $
                    </text>
                  </svg>
                  <span className="text-accent-gold font-bold font-heading text-sm">
                    {userBalance}
                  </span>
                </div>
              </div>
            )}

            {isAuthenticated ? (
              <>
                <NavLink to="/profile" className={mobileLinkClass}>
                  {user ? `Profile (${user.username})` : 'Profile'}
                </NavLink>
                {user && user.role === 'admin' && (
                  <NavLink to="/admin/dashboard" className={mobileLinkClass}>
                    Admin Dashboard
                  </NavLink>
                )}
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors duration-200"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-2">
                <Link
                  to="/login"
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-center text-text-secondary hover:text-text-primary border border-border-light hover:border-text-muted transition-colors duration-200"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-center bg-accent-gold hover:bg-accent-gold-dark text-bg-base font-heading transition-colors duration-200"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </nav>
      )}
    </header>
  );
};

export default Header;
