import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';

/**
 * useTournamentsList
 *
 * Owns the list-side state for TournamentsAdminPage:
 *   - status filter
 *   - rows / total
 *   - loading flag
 *   - fetchList(): re-runs the query with the current filter
 *
 * The page still owns the create-form, detail modal, and action handlers;
 * this hook is intentionally scoped to the table-data effect so behaviour
 * stays identical.
 *
 * @param {Object} opts
 * @param {(message: string) => void} opts.onError - toast.error callback
 * @param {number} [opts.limit=100] - page size sent to /admin/tournaments
 *
 * Returns:
 *   rows           — current tournaments page
 *   total          — total count from server
 *   loading        — fetch in flight
 *   statusFilter   — current status filter ('' = all)
 *   setStatusFilter
 *   fetchList()    — re-run query manually (e.g. after create / cancel)
 */
export default function useTournamentsList({ onError, limit = 100 } = {}) {
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const params = { limit };
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/admin/tournaments', { params });
      setRows(res.rows || []);
      setTotal(Number(res.total) || 0);
    } catch (error) {
      if (onError) onError(`Failed to load tournaments: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, onError, limit]);

  useEffect(() => { fetchList(); }, [fetchList]);

  return {
    rows,
    total,
    loading,
    statusFilter,
    setStatusFilter,
    fetchList,
  };
}
