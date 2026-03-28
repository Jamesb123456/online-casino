import React, { useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import Dashboard from '../../components/admin/Dashboard';

/**
 * Admin Dashboard Page
 * Main admin overview page showing casino statistics and metrics
 */
const AdminDashboardPage = () => {
  useEffect(() => {
    document.title = 'Admin Dashboard | Platinum Casino';
  }, []);
  return (
    <AdminLayout>
      <Dashboard />
    </AdminLayout>
  );
};

export default AdminDashboardPage;