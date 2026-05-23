import { useState, useEffect, useCallback } from 'react';
import adminService from '../../services/admin/adminService';

/**
 * usePlayerList
 *
 * Encapsulates the data-fetching, pagination, sorting, and filtering state
 * for the admin player-management table. Behaviour is identical to the
 * inlined logic that previously lived in `PlayerManagement.jsx`.
 *
 * Returns:
 *   players        — current page of players
 *   isLoading      — true while a fetch is in flight
 *   totalUsers     — total matching records reported by the server
 *   totalPages     — derived total pages = ceil(totalUsers / rowsPerPage)
 *   currentPage    — active page number (1-indexed)
 *   rowsPerPage    — page size (10/20/50/100)
 *   sortField      — current sort column
 *   sortDirection  — 'asc' | 'desc'
 *   searchTerm     — username search
 *   activeFilter   — 'all' | 'active' | 'inactive'
 *   roleFilter     — 'all' | 'user' | 'admin'
 *   setCurrentPage, setRowsPerPage, setSearchTerm, setActiveFilter, setRoleFilter — raw setters
 *   handleSortChange(field)            — toggle sort
 *   handleSearchChange(value)          — set search & reset page
 *   handleFilterChange(type, value)    — set active/role filter & reset page
 *   handleRowsPerPageChange(value)     — set page size & reset page
 *   refetch()                          — re-run the current query
 */
export default function usePlayerList() {
  const [players, setPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [sortField, setSortField] = useState('username');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');

  const fetchPlayers = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: rowsPerPage,
        sortBy: sortField,
        sortDir: sortDirection,
      };
      if (searchTerm) params.searchTerm = searchTerm;
      if (activeFilter !== 'all') params.activeOnly = activeFilter === 'active';
      if (roleFilter !== 'all') params.role = roleFilter;

      const response = await adminService.getPlayers(params);

      if (response && response.players) {
        setPlayers(response.players);
        const count = response.totalCount || response.players.length;
        setTotalUsers(count);
        setTotalPages(Math.ceil(count / rowsPerPage));
      } else {
        setPlayers([]);
        setTotalUsers(0);
        setTotalPages(1);
      }
    } catch (_error) {
      setPlayers([]);
      setTotalUsers(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, rowsPerPage, sortField, sortDirection, searchTerm, activeFilter, roleFilter]);

  useEffect(() => {
    fetchPlayers();
  }, [fetchPlayers]);

  const handleSortChange = useCallback((field) => {
    setSortField((prevField) => {
      if (prevField === field) {
        setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prevField;
      }
      setSortDirection('asc');
      return field;
    });
    setCurrentPage(1);
  }, []);

  const handleSearchChange = useCallback((value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  }, []);

  const handleFilterChange = useCallback((filterType, value) => {
    if (filterType === 'active') setActiveFilter(value);
    else if (filterType === 'role') setRoleFilter(value);
    setCurrentPage(1);
  }, []);

  const handleRowsPerPageChange = useCallback((value) => {
    setRowsPerPage(parseInt(value, 10));
    setCurrentPage(1);
  }, []);

  return {
    players,
    isLoading,
    totalUsers,
    totalPages,
    currentPage,
    rowsPerPage,
    sortField,
    sortDirection,
    searchTerm,
    activeFilter,
    roleFilter,
    setCurrentPage,
    handleSortChange,
    handleSearchChange,
    handleFilterChange,
    handleRowsPerPageChange,
    refetch: fetchPlayers,
  };
}
