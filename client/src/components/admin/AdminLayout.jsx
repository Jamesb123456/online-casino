import React, { useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { FaBars, FaTimes } from 'react-icons/fa';
import AdminNav from './AdminNav';

/**
 * Admin Dashboard Layout
 * Provides navigation and structure for all admin pages
 */
const AdminLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  
  // Mock authentication state - in a real app, would use auth context
  const isAdmin = true; // This should come from your auth context
  
  // If not admin, redirect to login
  if (!isAdmin) {
    return <Navigate to="/login" />;
  }

  // We no longer need navigation items here as they're now in AdminNav component

  return (
    <div className="flex h-screen bg-gray-900">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} h-screen bg-gray-800 text-white transition-all duration-300 fixed`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className={`text-xl font-bold text-purple-500 ${!sidebarOpen && 'hidden'}`}>Admin Portal</h2>
          <button 
            onClick={() => setSidebarOpen(prev => !prev)}
            className="p-1 rounded-md hover:bg-gray-700"
          >
            {sidebarOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>
        
        <div className={`${!sidebarOpen && 'hidden'}`}>
          <AdminNav />
        </div>
        
        {/* Collapsed version of navigation when sidebar is closed */}
        <div className={`${sidebarOpen && 'hidden'} mt-4`}>
          <div className="flex flex-col items-center space-y-6 pt-4">
            {/* Using just icons from AdminNav component */}
            <a href="/admin/dashboard" className="p-2 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white">
              <FaChartBar size={20} />
            </a>
            <a href="/admin/players" className="p-2 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white">
              <FaUsers size={20} />
            </a>
            <a href="/admin/game-stats" className="p-2 rounded-md hover:bg-gray-700 text-gray-300 hover:text-white">
              <FaChartBar size={20} />
            </a>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className={`flex-1 ${sidebarOpen ? 'ml-64' : 'ml-16'} transition-all duration-300`}>
        {/* Header */}
        <header className="bg-gray-800 p-4 text-white">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Casino Admin</h1>
            <div className="flex items-center space-x-4">
              <span className="text-purple-300">Admin User</span>
              <button className="px-3 py-1 bg-purple-600 rounded-md hover:bg-purple-700 transition-colors">
                Logout
              </button>
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="p-6 bg-gray-900 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;