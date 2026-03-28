import React, { useEffect } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import GameStatistics from '../../components/admin/GameStatistics';

/**
 * Game Statistics Page
 * Admin page displaying detailed game statistics and metrics
 */
const GameStatisticsPage = () => {
  useEffect(() => {
    document.title = 'Game Statistics | Platinum Casino';
  }, []);
  return (
    <AdminLayout>
      <GameStatistics />
    </AdminLayout>
  );
};

export default GameStatisticsPage;