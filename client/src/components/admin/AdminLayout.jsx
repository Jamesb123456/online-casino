import React, { useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { FaBars, FaTimes, FaChartBar, FaUsers } from 'react-icons/fa';
import AdminNav from './AdminNav';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

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

  return (
    <div className="flex h-screen bg-bg-body">
      {/* Sidebar */}
      <div 
        className={`
          ${sidebarOpen ? 'w-72' : 'w-20'} 
          h-screen bg-bg-card border-r border-gray-800 text-white 
          transition-all duration-300 fixed 
          shadow-xl z-30
        `}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <div className={`transition-opacity duration-300 ${!sidebarOpen && 'opacity-0 w-0 overflow-hidden'}`}>
            <h2 className="text-xl font-bold bg-gradient-to-r from-primary to-primary-light text-transparent bg-clip-text">
              Admin Portal
            </h2>
          </div>
          <button 
            onClick={() => setSidebarOpen(prev => !prev)}
            className="p-2 rounded-md hover:bg-bg-elevated bg-white/5 backdrop-blur-sm border border-white/5"
          >
            {sidebarOpen ? <FaTimes className="text-gray-300" /> : <FaBars className="text-gray-300" />}
          </button>
        </div>
        
        <div className={`transition-opacity duration-300 ${!sidebarOpen && 'opacity-0 w-0 overflow-hidden'}`}>
          <AdminNav />
        </div>
        
        {/* Collapsed version of navigation when sidebar is closed */}
        <div className={`${sidebarOpen && 'hidden'} mt-6`}>
          <div className="flex flex-col items-center space-y-8 pt-4">
            {/* Using just icons from AdminNav component */}
            <a href="/admin/dashboard" className="p-3 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
              <FaChartBar size={20} />
            </a>
            <a href="/admin/players" className="p-3 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors">
              <FaUsers size={20} />
            </a>
            <a href="/admin/game-stats" className="p-3 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors">
              <FaChartBar size={20} />
            </a>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className={`flex-1 ${sidebarOpen ? 'ml-72' : 'ml-20'} transition-all duration-300`}>
        {/* Header */}
        <header className="bg-bg-card bg-opacity-70 backdrop-blur-lg px-6 py-4 text-white border-b border-gray-800 shadow-md sticky top-0 z-20">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 text-transparent bg-clip-text">
                Casino Admin
              </h1>
              <Badge variant="primary" className="ml-4" size="sm">Management Suite</Badge>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="px-3 py-1.5 bg-bg-subtle rounded-full text-sm font-medium border border-gray-800">
                <span className="text-gray-400 mr-2">Admin:</span>
                <span className="text-primary">SuperUser</span>
              </div>
              <Button variant="outline" size="sm">
                Logout
              </Button>
            </div>
          </div>
        </header>
        
        {/* Page Content */}
        <main className="p-6 bg-bg-body min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;