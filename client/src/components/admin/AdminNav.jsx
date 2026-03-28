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
      icon: '\uD83D\uDCCA',
      badge: null
    },
    {
      name: 'Players',
      path: '/admin/players',
      icon: '\uD83D\uDC65',
      badge: null
    },
    {
      name: 'Game Statistics',
      path: '/admin/game-stats',
      icon: '\uD83D\uDCC8',
      badge: null
    },
    {
      name: 'Transactions',
      path: '/admin/transactions',
      icon: '\uD83D\uDCB0',
      badge: { text: 'New', variant: 'primary' }
    }
  ];

  return (
    <nav className="text-text-secondary py-4 px-2 flex flex-col h-full" aria-label="Admin navigation">
      <ul className="space-y-1 mt-4">
        {navItems.map((item, index) => (
          <li key={index}>
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `flex items-center py-3.5 px-4 rounded-lg transition-all duration-200 ${
                  isActive
                    ? 'bg-accent-gold/20 text-accent-gold font-medium'
                    : 'hover:bg-bg-elevated hover:text-text-primary'
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

      <div className="mt-auto border-t border-border pt-6 px-4">
        <NavLink
          to="/"
          className={({isActive}) =>
            `flex items-center py-2.5 px-3 rounded-lg text-sm transition-colors ${
              isActive ? 'bg-accent-gold/20 text-accent-gold' : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
            }`
          }
        >
          <span className="mr-2">{'\uD83C\uDFE0'}</span>
          Return to Casino
        </NavLink>
      </div>
    </nav>
  );
};

export default AdminNav;
