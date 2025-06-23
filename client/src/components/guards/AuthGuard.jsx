import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import Loading from '../ui/Loading';

/**
 * AuthGuard Component
 * Protects routes that require user authentication
 * Redirects to login page if user is not authenticated
 */
const AuthGuard = ({ children }) => {
  const { user, loading, isAuthenticated } = useContext(AuthContext);
  const location = useLocation();

  if (loading) {
    // Show loading indicator while checking authentication
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900">
        <Loading size="md" message="Verifying authentication..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login if not authenticated
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // User is authenticated, render the protected route
  return children;
};

export default AuthGuard;