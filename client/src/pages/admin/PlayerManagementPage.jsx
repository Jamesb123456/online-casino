import React from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import PlayerManagement from '../../components/admin/PlayerManagement';

/**
 * Player Management Page
 * Admin page for managing casino player accounts
 */
const PlayerManagementPage = () => {
  return (
    <AdminLayout>
      <PlayerManagement />
    </AdminLayout>
  );
};

export default PlayerManagementPage;