import React, { useState, useEffect, useContext } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiVolume2, FiVolumeX, FiMenu, FiX } from 'react-icons/fi';
import { AuthContext } from '../contexts/AuthContext';
import AnimatedBalance from './casino/AnimatedBalance';
import { useSound } from './casino/SoundProvider';

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useContext(AuthContext);
  const { muted, setMute } = useSound();

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

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const userBalance = Number.isFinite(user?.balance) ? user.balance : 0;

  // Desktop nav link style helper
  const desktopLinkClass = ({ isActive }) =>
    `px-3 py-2 text-sm font-medium transition-colors duration-200 border-b-2 cursor-pointer ${
      isActive
        ? 'text-accent-gold border-accent-gold'
        : 'text-text-secondary hover:text-accent-gold border-transparent'
    }`;

  // Mobile nav link style helper
  const mobileLinkClass = ({ isActive }) =>
    `block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer ${
      isActive
        ? 'text-accent-gold bg-accent-gold/10'
        : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
    }`;

  const toggleMute = () => setMute(!muted);

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={`fixed top-0 left-0 right-0 z-50 glass border-b border-white/10 transition-shadow duration-300 ${
        scrolled ? 'shadow-card' : ''
      }`}
    >
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-1 shrink-0 cursor-pointer">
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

          {/* Right side: balance + mute + auth */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Animated balance (desktop) */}
            {isAuthenticated && (
              <div className="hidden md:flex" data-testid="header-balance">
                <AnimatedBalance value={userBalance} currency="$" />
              </div>
            )}

            {/* Sound mute toggle */}
            <button
              type="button"
              onClick={toggleMute}
              aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
              aria-pressed={muted}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-text-secondary hover:text-accent-gold hover:bg-white/5 transition-colors duration-200 cursor-pointer"
            >
              {muted ? <FiVolumeX className="h-5 w-5" aria-hidden="true" /> : <FiVolume2 className="h-5 w-5" aria-hidden="true" />}
            </button>

            {/* Desktop auth buttons */}
            <div className="hidden lg:flex items-center gap-2">
              {isAuthenticated ? (
                <>
                  <NavLink to="/profile" className={desktopLinkClass}>
                    {user ? user.username : 'Profile'}
                  </NavLink>
                  {user && user.role === 'admin' && (
                    <NavLink to="/admin/dashboard" className={desktopLinkClass}>
                      Admin
                    </NavLink>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="ml-1 px-4 py-1.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/30 transition-colors duration-200 cursor-pointer"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-1.5 rounded-lg text-sm font-medium text-text-secondary hover:text-text-primary border border-border-light hover:border-text-muted transition-colors duration-200 cursor-pointer"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="px-4 py-1.5 rounded-lg text-sm font-medium bg-accent-gold hover:bg-accent-gold-dark text-bg-base font-heading transition-colors duration-200 cursor-pointer"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>

            {/* Mobile hamburger */}
            <button
              type="button"
              onClick={toggleMenu}
              className="lg:hidden inline-flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary hover:text-accent-gold transition-colors duration-200 cursor-pointer"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <FiX className="h-6 w-6" aria-hidden="true" /> : <FiMenu className="h-6 w-6" aria-hidden="true" />}
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
              <div className="flex items-center justify-between bg-bg-elevated/60 rounded-lg px-3 py-2 border border-accent-gold/20 my-2">
                <AnimatedBalance value={userBalance} currency="$" />
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
                  type="button"
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors duration-200 cursor-pointer"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="flex flex-col gap-2 pt-2">
                <Link
                  to="/login"
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-center text-text-secondary hover:text-text-primary border border-border-light hover:border-text-muted transition-colors duration-200 cursor-pointer"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-2.5 rounded-lg text-sm font-medium text-center bg-accent-gold hover:bg-accent-gold-dark text-bg-base font-heading transition-colors duration-200 cursor-pointer"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        </nav>
      )}
    </motion.header>
  );
};

export default Header;
