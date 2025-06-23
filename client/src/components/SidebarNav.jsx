import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

// Icons for the sidebar
const Icons = {
  crash: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" style={{maxWidth: '16px', maxHeight: '16px'}}>
      <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
    </svg>
  ),
  roulette: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" style={{maxWidth: '16px', maxHeight: '16px'}}>
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
    </svg>
  ),
  blackjack: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" style={{maxWidth: '16px', maxHeight: '16px'}}>
      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  ),
  plinko: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" style={{maxWidth: '16px', maxHeight: '16px'}}>
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
    </svg>
  ),
  wheel: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" style={{maxWidth: '16px', maxHeight: '16px'}}>
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 4a1 1 0 000 2 1 1 0 011 1v1H7a1 1 0 000 2h1v3a1 1 0 01-1 1 1 1 0 100 2h6a1 1 0 100-2 1 1 0 01-1-1v-3h1a1 1 0 100-2h-1V7a1 1 0 011-1 1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
  ),
  chicken: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" style={{maxWidth: '16px', maxHeight: '16px'}}>
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  ),
  admin: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" style={{maxWidth: '16px', maxHeight: '16px'}}>
      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  ),
  promotions: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" style={{maxWidth: '16px', maxHeight: '16px'}}>
      <path fillRule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm3 0a1 1 0 10-1-1v1h1z" clipRule="evenodd" />
      <path d="M9 11H3v5a2 2 0 002 2h4v-7zM11 18h4a2 2 0 002-2v-5h-6v7z" />
    </svg>
  ),
  support: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" style={{maxWidth: '16px', maxHeight: '16px'}}>
      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  ),
  leaderboard: (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" style={{maxWidth: '16px', maxHeight: '16px'}}>
      <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zM5 11a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zM11 5a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zM14 11a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0v-1h-1a1 1 0 110-2h1v-1a1 1 0 011-1z" />
    </svg>
  ),
};

// Navigation Category - renders a category with expandable items
const NavCategory = ({ title, items, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const location = useLocation();

  return (
    <div className="mb-3">
      <button
        className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium text-white bg-[#1e3446] hover:bg-[#2a4359] rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-[#ffc107] transition-all duration-200"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>{title}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      
      {isOpen && (
        <div className="mt-2 space-y-1">
          {items.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center px-6 py-2 text-sm group transition-colors duration-200 ${
                location.pathname === item.path
                ? 'text-[#ffc107] bg-[#213749] border-l-2 border-[#ffc107]'
                : 'text-gray-300 hover:text-white hover:bg-[#213749]/70 border-l-2 border-transparent'
              } rounded-sm`}
            >
              <div className={`w-5 h-5 mr-3 ${location.pathname === item.path ? 'text-[#ffc107]' : 'text-gray-400 group-hover:text-[#ffc107]'}`}>
                {item.icon}
              </div>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

// Single Nav Item - renders a single item without category
const NavItem = ({ path, label, icon }) => {
  const location = useLocation();
  const isActive = location.pathname === path;

  return (
    <Link
      to={path}
      className={`flex items-center px-4 py-3 text-sm group transition-all duration-200 ${
        isActive
        ? 'text-[#ffc107] bg-[#213749] border-l-2 border-[#ffc107]'
        : 'text-gray-300 hover:text-white hover:bg-[#213749]/70 border-l-2 border-transparent'
      } rounded-sm`}
    >
      <div className={`w-5 h-5 mr-3 ${isActive ? 'text-[#ffc107]' : 'text-gray-400 group-hover:text-[#ffc107]'}`}>
        {icon}
      </div>
      {label}
    </Link>
  );
};

const SidebarNav = () => {
  return (
    <div className="h-full w-64 bg-gradient-to-b from-[#0f1923] to-[#1a2c3d] border-r border-[#2a3f52]" data-testid="sidebar-nav" style={{zIndex: 30, position: 'relative', minHeight: '100vh'}}>
      {/* Logo area */}
      <div className="flex items-center px-6 py-6 border-b border-[#2a3f52]">
        <div className="font-bold text-2xl text-white">
          <span className="text-[#ffc107]">Virtual</span> Casino
        </div>
      </div>

      {/* Navigation area */}
      <div className="p-4 space-y-4">
        {/* Casino Games Category */}
        <NavCategory 
          title="Casino Games" 
          defaultOpen={true}
          items={[
            { path: '/games/crash', label: 'Crash', icon: Icons.crash },
            { path: '/games/roulette', label: 'Roulette', icon: Icons.roulette },
            { path: '/games/blackjack', label: 'Blackjack', icon: Icons.blackjack },
            { path: '/games/plinko', label: 'Plinko', icon: Icons.plinko },
            { path: '/games/wheel', label: 'Wheel', icon: Icons.wheel },
            { path: '/games/chicken', label: 'Chicken', icon: Icons.chicken },
          ]} 
        />

        {/* Single Items */}
        <div className="my-4 space-y-1">
          <NavItem path="/games" label="All Games" icon={Icons.blackjack} />
          <NavItem path="/leaderboard" label="Leaderboard" icon={Icons.leaderboard} />
          <NavItem path="/promotions" label="Promotions" icon={Icons.promotions} />
        </div>

        {/* Support & Admin */}
        <NavCategory 
          title="Support & Admin" 
          items={[
            { path: '/support', label: 'Support', icon: Icons.support },
            { path: '/admin/dashboard', label: 'Admin Dashboard', icon: Icons.admin },
            { path: '/admin/players', label: 'Player Management', icon: Icons.admin },
            { path: '/admin/statistics', label: 'Game Statistics', icon: Icons.admin },
            { path: '/admin/transactions', label: 'Transactions', icon: Icons.admin },
          ]} 
        />
      </div>
    </div>
  );
};

export default SidebarNav;