import React, { useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import PlayerManagement from '../../components/admin/PlayerManagement';

/**
 * Player Management Page
 * Admin page for managing casino player accounts
 */
const PlayerManagementPage = () => {
  useEffect(() => {
    document.title = 'Player Management | Platinum Casino';
  }, []);
  return (
    <AdminLayout>
      <PlayerManagement />
    </AdminLayout>
  );
};

export default PlayerManagementPage;