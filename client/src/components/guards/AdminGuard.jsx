import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import api from '../../services/api';

/**
 * AdminGuard Component
 * Protects admin routes from unauthorized access
 * Redirects to login page if user is not authenticated as admin
 */
const AdminGuard = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const verifyAdmin = async () => {
      try {
        // Check if user has admin token in localStorage
        const token = localStorage.getItem('token');
        
        if (!token) {
          setIsAdmin(false);
          setIsLoading(false);
          return;
        }

        // Verify token is valid and has admin privileges
        const response = await api.get('/auth/verify-admin', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (response.data && response.data.isAdmin) {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error('Error verifying admin status:', error);
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    verifyAdmin();
  }, []);

  if (isLoading) {
    // Show loading indicator while checking credentials
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!isAdmin) {
    // Redirect to login if not admin
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default AdminGuard;