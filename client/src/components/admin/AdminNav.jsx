import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  FaTachometerAlt, 
  FaUsers, 
  FaChartBar, 
  FaMoneyBillWave,
  FaCog,
  FaHome
} from 'react-icons/fa';
import Badge from '../ui/Badge';

/**
 * AdminNav Component
 * Provides navigation links for the admin dashboard
 */
const AdminNav = () => {
  // Navigation items with icons and paths
  const navItems = [
    { 
      name: 'Dashboard', 
      icon: <FaTachometerAlt />, 
      path: '/admin/dashboard',
      badge: null
    },
    { 
      name: 'Players', 
      icon: <FaUsers />, 
      path: '/admin/players',
      badge: null 
    },
    { 
      name: 'Game Statistics', 
      icon: <FaChartBar />, 
      path: '/admin/game-stats',
      badge: null 
    },
    { 
      name: 'Transactions', 
      icon: <FaMoneyBillWave />, 
      path: '/admin/transactions',
      badge: { text: 'New', variant: 'primary' }
    },
    { 
      name: 'Settings', 
      icon: <FaCog />, 
      path: '/admin/settings',
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
                    ? 'bg-primary/20 text-primary font-medium' 
                    : 'hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <span className={`mr-3 text-lg transition-colors ${
                ({ isActive }) => isActive ? 'text-primary' : 'text-gray-400'
              }`}>
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
      
      <div className="mt-auto border-t border-gray-800 pt-6 px-4">
        <NavLink 
          to="/" 
          className={({isActive}) => 
            `flex items-center py-2.5 px-3 rounded-lg text-sm transition-colors ${
              isActive ? 'bg-accent/10 text-accent' : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`
          }
        >
          <FaHome className="mr-2" />
          Return to Casino
        </NavLink>
      </div>
    </nav>
  );
};

export default AdminNav;