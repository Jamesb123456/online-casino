import React from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import Dashboard from '../../components/admin/Dashboard';

/**
 * Admin Dashboard Page
 * Main admin overview page showing casino statistics and metrics
 */
const AdminDashboardPage = () => {
  return (
    <AdminLayout>
      <Dashboard />
    </AdminLayout>
  );
};

export default AdminDashboardPage;