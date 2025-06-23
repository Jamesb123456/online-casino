import React from 'react';
import { Link } from 'react-router-dom';

/**
 * MainLayout Component
 * Provides a consistent layout structure for casino game pages with header and footer
 */
const MainLayout = ({ children }) => {
  return (
    <div className="flex flex-col min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Link to="/" className="text-amber-500 font-bold text-xl">
              Virtual Casino
            </Link>
            <nav className="hidden md:block ml-8">
              <ul className="flex space-x-6">
                <li>
                  <Link to="/" className="hover:text-amber-500 transition-colors">
                    Home
                  </Link>
                </li>
                <li>
                  <Link to="/games" className="hover:text-amber-500 transition-colors">
                    Games
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <Link to="/login" className="px-4 py-2 rounded hover:bg-gray-700 transition-colors">
              Login
            </Link>
            <Link to="/register" className="bg-amber-500 text-white px-4 py-2 rounded hover:bg-amber-600 transition-colors">
              Register
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-sm text-gray-400 mb-4 md:mb-0">
              © {new Date().getFullYear()} Virtual Casino. All rights reserved.
            </div>
            <div className="flex space-x-6">
              <Link to="/terms" className="text-sm text-gray-400 hover:text-white transition-colors">
                Terms of Service
              </Link>
              <Link to="/privacy" className="text-sm text-gray-400 hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link to="/responsible-gaming" className="text-sm text-gray-400 hover:text-white transition-colors">
                Responsible Gaming
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;