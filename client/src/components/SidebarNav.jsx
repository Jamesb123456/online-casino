import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

// Navigation Category - renders a category with expandable items
const NavCategory = ({ title, items, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const location = useLocation();
  
  return (
    <div className="mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full px-4 py-2 text-left text-white bg-[#1a2c3d] hover:bg-[#213749] rounded-sm transition-colors"
      >
        <span className="font-medium">{title}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'transform rotate-180' : ''}`}
          xmlns="http://www.w3.org/2000/svg"
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
              <span className="ml-2">{item.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

// Single Nav Item - renders a single item without category
const NavItem = ({ path, label }) => {
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
      <span className="ml-2">{label}</span>
    </Link>
  );
};

const SidebarNav = () => {
  return (
    <div className="h-full w-64 bg-gradient-to-b from-[#0f1923] to-[#1a2c3d] border-r border-[#2a3f52]" data-testid="sidebar-nav" style={{zIndex: 30, position: 'relative', minHeight: '100vh'}}>
      {/* Logo area */}
      <div className="flex items-center px-6 py-6 border-b border-[#2a3f52]">
        <div className="font-bold text-2xl text-white">
          <span className="text-[#ffc107]">Platinum</span> Casino
        </div>
      </div>

      {/* Navigation area */}
      <div className="p-4 space-y-4">
        {/* Casino Games Category */}
        <NavCategory 
          title="Casino Games" 
          defaultOpen={true}
          items={[
            { path: '/games/crash', label: 'Crash' },
            { path: '/games/roulette', label: 'Roulette' },
            { path: '/games/blackjack', label: 'Blackjack' },
            { path: '/games/plinko', label: 'Plinko' },
            { path: '/games/wheel', label: 'Wheel' },
            { path: '/games/chicken', label: 'Chicken' },
          ]} 
        />

        {/* Single Items */}
        <div className="my-4 space-y-1">
          <NavItem path="/games" label="All Games" />
          <NavItem path="/leaderboard" label="Leaderboard" />
          <NavItem path="/promotions" label="Promotions" />
        </div>

        {/* Support & Admin */}
        <NavCategory 
          title="Support & Admin" 
          items={[
            { path: '/support', label: 'Support' },
            { path: '/admin/dashboard', label: 'Admin Dashboard' },
            { path: '/admin/players', label: 'Player Management' },
            { path: '/admin/statistics', label: 'Game Statistics' },
            { path: '/admin/transactions', label: 'Transactions' },
          ]} 
        />
      </div>
    </div>
  );
};

export default SidebarNav;