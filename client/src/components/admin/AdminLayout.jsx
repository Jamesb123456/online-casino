import React, { useState } from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import AdminNav from './AdminNav';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import useAuth from '../../hooks/useAuth';

/**
 * Admin Dashboard Layout
 * Provides navigation and structure for all admin pages
 */
const AdminLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const { user, loading, logout } = useAuth();

  // Check if user is logged in and has admin role
  const isAdmin = user && user.role === 'admin';

  // Show loading state while auth is being checked
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-base text-text-primary">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-gold"></div>
        <span className="ml-3">Loading admin panel...</span>
      </div>
    );
  }

  // If not admin, redirect to login
  if (!isAdmin) {
    return <Navigate to="/login" state={{ from: location }} />;
  }

  return (
    <div className="flex h-screen bg-bg-base">
      {/* Sidebar */}
      <div
        className={`
          ${sidebarOpen ? 'w-72' : 'w-20'}
          h-screen bg-bg-card border-r border-border text-text-primary
          transition-all duration-300 fixed
          shadow-xl z-30
        `}
      >
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className={`transition-opacity duration-300 ${!sidebarOpen && 'opacity-0 w-0 overflow-hidden'}`}>
            <h2 className="text-xl font-bold text-gold-gradient">
              Admin Portal
            </h2>
          </div>
          <button
            onClick={() => setSidebarOpen(prev => !prev)}
            className="p-2 rounded-md hover:bg-bg-elevated bg-bg-elevated/50 backdrop-blur-sm border border-border-light cursor-pointer text-text-secondary hover:text-text-primary transition-colors"
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? "\u2715" : "\u2261"}
          </button>
        </div>

        <div className={`transition-opacity duration-300 ${!sidebarOpen && 'opacity-0 w-0 overflow-hidden'}`}>
          <AdminNav />
        </div>

        {/* Collapsed version of navigation when sidebar is closed */}
        <div className={`${sidebarOpen && 'hidden'} mt-6`}>
          <div className="flex flex-col items-center space-y-8 pt-4">
            <a href="/admin/dashboard" className="p-3 rounded-lg bg-accent-gold/20 hover:bg-accent-gold/30 text-accent-gold transition-colors font-bold">
              Dashboard
            </a>
            <a href="/admin/players" className="p-3 rounded-lg hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors font-bold">
              Players
            </a>
            <a href="/admin/game-stats" className="p-3 rounded-lg hover:bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors font-bold">
              Stats
            </a>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 ${sidebarOpen ? 'ml-72' : 'ml-20'} transition-all duration-300`}>
        {/* Header */}
        <header className="bg-bg-card/90 backdrop-blur-lg px-6 py-4 text-text-primary border-b border-border shadow-md sticky top-0 z-20">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-text-primary">
                Casino Admin
              </h1>
              <Badge variant="primary" className="ml-4" size="sm">Management Suite</Badge>
            </div>

            <div className="flex items-center space-x-4">
              <div className="px-3 py-1.5 bg-bg-elevated rounded-full text-sm font-medium border border-border-light">
                <span className="text-text-muted mr-2">Admin:</span>
                <span className="text-accent-gold">{user.username}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => logout()}
              >
                Logout
              </Button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 bg-bg-base min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
