import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  FaTachometerAlt, 
  FaUsers, 
  FaChartBar, 
  FaMoneyBillWave,
  FaCog 
} from 'react-icons/fa';

/**
 * AdminNav Component
 * Provides navigation links for the admin dashboard
 */
const AdminNav = () => {
  // Navigation items with icons and paths
  const navItems = [
    { name: 'Dashboard', icon: <FaTachometerAlt />, path: '/admin/dashboard' },
    { name: 'Players', icon: <FaUsers />, path: '/admin/players' },
    { name: 'Game Statistics', icon: <FaChartBar />, path: '/admin/game-stats' },
    { name: 'Transactions', icon: <FaMoneyBillWave />, path: '/admin/transactions' },
    { name: 'Settings', icon: <FaCog />, path: '/admin/settings' }
  ];

  return (
    <nav className="bg-gray-800 text-gray-300 py-4 px-2 flex flex-col h-full">
      <div className="text-xl font-bold mb-8 text-purple-500 px-4">Admin Portal</div>
      <ul className="space-y-2">
        {navItems.map((item, index) => (
          <li key={index}>
            <NavLink 
              to={item.path}
              className={({ isActive }) => 
                `flex items-center py-3 px-4 rounded-md transition-colors ${
                  isActive 
                    ? 'bg-purple-700 text-white' 
                    : 'hover:bg-gray-700 hover:text-white'
                }`
              }
            >
              <span className="mr-3">{item.icon}</span>
              {item.name}
            </NavLink>
          </li>
        ))}
      </ul>
      
      <div className="mt-auto pt-6 px-4">
        <NavLink 
          to="/" 
          className="flex items-center py-2 text-sm text-gray-400 hover:text-white"
        >
          Return to Casino
        </NavLink>
      </div>
    </nav>
  );
};

export default AdminNav;