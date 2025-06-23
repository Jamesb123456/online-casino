import React from 'react';
import { NavLink } from 'react-router-dom';
import Badge from '../ui/Badge';

/**
 * AdminNav Component
 * Provides navigation links for the admin dashboard
 */
const AdminNav = () => {
  // Navigation items with paths and text icons
  const navItems = [
    { 
      name: 'Dashboard', 
      path: '/admin/dashboard',
      icon: '📊',
      badge: null
    },
    { 
      name: 'Players', 
      path: '/admin/players',
      icon: '👥',
      badge: null 
    },
    { 
      name: 'Game Statistics', 
      path: '/admin/game-stats',
      icon: '📈',
      badge: null 
    },
    { 
      name: 'Transactions', 
      path: '/admin/transactions',
      icon: '💰',
      badge: { text: 'New', variant: 'primary' }
    },
    { 
      name: 'Settings', 
      path: '/admin/settings',
      icon: '⚙️',
      badge: null 
    }
  ];

  return (
    <nav className="text-gray-300 py-4 px-2 flex flex-col h-full">
      <ul className="space-y-1 mt-4">
        {navItems.map((item, index) => (
          <li key={index}>
            <NavLink 
              to={item.path}
              className={({ isActive }) => 
                `flex items-center py-3.5 px-4 rounded-lg transition-all duration-200 ${
                  isActive 
                    ? 'bg-blue-600/20 text-blue-400 font-medium' 
                    : 'hover:bg-gray-700/50 hover:text-white'
                }`
              }
            >
              <span className="mr-3 text-lg">
                {item.icon}
              </span>
              <span>{item.name}</span>
              {item.badge && (
                <div className="ml-auto">
                  <Badge 
                    variant={item.badge.variant} 
                    size="xs"
                    pill={true}
                    glow={item.badge.variant === 'primary'}
                  >
                    {item.badge.text}
                  </Badge>
                </div>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      
      <div className="mt-auto border-t border-gray-700 pt-6 px-4">
        <NavLink 
          to="/" 
          className={({isActive}) => 
            `flex items-center py-2.5 px-3 rounded-lg text-sm transition-colors ${
              isActive ? 'bg-yellow-600/20 text-yellow-400' : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`
          }
        >
          <span className="mr-2">🏠</span>
          Return to Casino
        </NavLink>
      </div>
    </nav>
  );
};

export default AdminNav;