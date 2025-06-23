import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import Loading from '../ui/Loading';

/**
 * AdminGuard Component
 * Protects admin routes from unauthorized access
 * Redirects to login page if user is not authenticated as admin
 */
const AdminGuard = ({ children }) => {
  const { user, loading, isAuthenticated } = useContext(AuthContext);
  const location = useLocation();

  if (loading) {
    // Show loading indicator while checking credentials
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900">
        <Loading size="lg" message="Verifying admin access..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login if not authenticated
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user || user.role !== 'admin') {
    // Redirect to home if not admin
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminGuard;