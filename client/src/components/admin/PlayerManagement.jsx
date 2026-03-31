import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import adminService from '../../services/admin/adminService';
import { FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';

/**
 * Player Management Component
 * Provides interface for administrators to manage players
 */
const PlayerManagement = () => {
  const navigate = useNavigate();
  // State for players data
  const [players, setPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Sorting and pagination
  const [sortField, setSortField] = useState('username');
  const [sortDirection, setSortDirection] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalUsers, setTotalUsers] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'active', 'inactive'
  const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'user', 'admin'
  
  // State for modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showFundModal, setShowFundModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    balance: 0,
    role: 'player',
    isActive: true
  });
  
  const [fundAmount, setFundAmount] = useState(0);
  
  // Fetch players data from API
  const fetchPlayers = async () => {
    setIsLoading(true);
    try {
      // Prepare query params for direct database table access
      const params = {
        page: currentPage,
        limit: rowsPerPage,
        sortBy: sortField,
        sortDir: sortDirection
      };
      
      // Add filters if set
      if (searchTerm) params.searchTerm = searchTerm;
      if (activeFilter !== 'all') params.activeOnly = activeFilter === 'active';
      if (roleFilter !== 'all') params.role = roleFilter;
      
      const response = await adminService.getPlayers(params);
      
      if (response && response.players) {
        setPlayers(response.players);
        setTotalUsers(response.totalCount || response.players.length);
        setTotalPages(Math.ceil((response.totalCount || response.players.length) / rowsPerPage));
      } else {
        setPlayers([]);
        setTotalUsers(0);
        setTotalPages(1);
      }
    } catch (error) {
      setPlayers([]);
      setTotalUsers(0);
      setTotalPages(1);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch players when parameters change
  useEffect(() => {
    fetchPlayers();
  }, [currentPage, rowsPerPage, sortField, sortDirection, searchTerm, activeFilter, roleFilter]);
  
  // Handle sort toggle
  const handleSortChange = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1); // Reset to first page on sort change
  };
  
  // Get sort icon for column
  const getSortIcon = (field) => {
    if (sortField !== field) return <FaSort className="text-text-muted" />;
    return sortDirection === 'asc' ? <FaSortUp /> : <FaSortDown />;
  };
  
  // Handle search input changes - debounced search
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page on search
  };
  
  // Handle filter changes
  const handleFilterChange = (filterType, value) => {
    if (filterType === 'active') {
      setActiveFilter(value);
    } else if (filterType === 'role') {
      setRoleFilter(value);
    }
    setCurrentPage(1); // Reset to first page on filter change
  };
  
  // Handle rows per page change
  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(parseInt(e.target.value));
    setCurrentPage(1); // Reset to first page
  };
  
  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };
  
  // Format currency
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };
  
  // Add new player
  const handleAddPlayer = async () => {
    try {
      const playerData = {
        ...formData,
        balance: parseFloat(formData.balance),
        gamesPlayed: 0
      };
      
      const response = await adminService.createPlayer(playerData);
      
      if (response && response.player) {
        fetchPlayers(); // Refresh the player list
      }
      
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Error creating player:', error);
      alert('Failed to create player. Please try again.');
    }
  };
  
  // Prepare edit form
  const handleEditClick = (player) => {
    setCurrentPlayer(player);
    setFormData({
      username: player.username,
      email: player.email,
      balance: player.balance,
      role: player.role,
      isActive: player.isActive
    });
    setShowEditModal(true);
  };
  
  // Update player
  const handleUpdatePlayer = async () => {
    try {
      await adminService.updatePlayer(currentPlayer.id, formData);
      fetchPlayers(); // Refresh the player list
      setShowEditModal(false);
      resetForm();
    } catch (error) {
      console.error('Error updating player:', error);
      alert('Failed to update player. Please try again.');
    }
  };
  
  // Prepare fund modal
  const handleFundClick = (player) => {
    setCurrentPlayer(player);
    setFundAmount(0);
    setShowFundModal(true);
  };
  
  // Add/remove funds
  const handleFundUpdate = async (operation) => {
    try {
      const amount = parseFloat(fundAmount);
      
      if (operation === 'add') {
        await adminService.addFunds(currentPlayer.id, amount);
      } else {
        await adminService.removeFunds(currentPlayer.id, amount);
      }
      
      fetchPlayers(); // Refresh the player list
      setShowFundModal(false);
    } catch (error) {
      console.error(`Error ${operation === 'add' ? 'adding' : 'removing'} funds:`, error);
      alert(`Failed to ${operation === 'add' ? 'add' : 'remove'} funds. Please try again.`);
    }
  };
  
  // Prepare delete confirmation
  const handleDeleteClick = (player) => {
    setCurrentPlayer(player);
    setShowDeleteModal(true);
  };
  
  // Delete player
  const handleDeletePlayer = async () => {
    try {
      await adminService.deletePlayer(currentPlayer.id);
      fetchPlayers(); // Refresh the player list
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Error deleting player:', error);
      alert('Failed to delete player. Please try again.');
    }
  };
  
  // Reset form to default state
  const resetForm = () => {
    setFormData({
      username: '',
      email: '',
      balance: 0,
      role: 'player',
      isActive: true
    });
    setCurrentPlayer(null);
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Player Management</h2>
          <Button color="primary" onClick={() => setShowAddModal(true)}>
            Add New Player
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label htmlFor="player-search" className="sr-only">Search by username</label>
            <input
              type="text"
              id="player-search"
              className="w-full p-2 bg-bg-elevated border border-border-light rounded-lg text-text-primary"
              placeholder="Search by username..."
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>

          {/* Status Filter */}
          <div>
            <label htmlFor="player-status-filter" className="sr-only">Filter by status</label>
            <select
              id="player-status-filter"
              className="w-full p-2 bg-bg-elevated border border-border-light rounded-lg text-text-primary cursor-pointer"
              value={activeFilter}
              onChange={(e) => handleFilterChange('active', e.target.value)}
            >
              <option value="all">All Users</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Role Filter */}
          <div>
            <label htmlFor="player-role-filter" className="sr-only">Filter by role</label>
            <select
              id="player-role-filter"
              className="w-full p-2 bg-bg-elevated border border-border-light rounded-lg text-text-primary cursor-pointer"
              value={roleFilter}
              onChange={(e) => handleFilterChange('role', e.target.value)}
            >
              <option value="all">All Roles</option>
              <option value="user">Users</option>
              <option value="admin">Admins</option>
            </select>
          </div>
        </div>
        
        {isLoading ? (
          <div className="text-center py-8">
            <p>Loading players...</p>
          </div>
        ) : players.length === 0 ? (
          <div className="text-center py-8">
            <p>No players found.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-bg-elevated text-left">
                    <th className="p-3 border-b border-border cursor-pointer" onClick={() => handleSortChange('id')}>
                      ID {getSortIcon('id')}
                    </th>
                    <th className="p-3 border-b border-border cursor-pointer" onClick={() => handleSortChange('username')}>
                      Username {getSortIcon('username')}
                    </th>
                    <th className="p-3 border-b border-border cursor-pointer" onClick={() => handleSortChange('isActive')}>
                      Status {getSortIcon('isActive')}
                    </th>
                    <th className="p-3 border-b border-border cursor-pointer" onClick={() => handleSortChange('role')}>
                      Role {getSortIcon('role')}
                    </th>
                    <th className="p-3 border-b border-border cursor-pointer" onClick={() => handleSortChange('balance')}>
                      Balance {getSortIcon('balance')}
                    </th>
                    <th className="p-3 border-b border-border cursor-pointer" onClick={() => handleSortChange('createdAt')}>
                      Created {getSortIcon('createdAt')}
                    </th>
                    <th className="p-3 border-b border-border cursor-pointer" onClick={() => handleSortChange('lastLogin')}>
                      Last Login {getSortIcon('lastLogin')}
                    </th>
                    <th className="p-3 border-b border-border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map(player => (
                    <tr key={player.id} className="border-b border-border hover:bg-bg-elevated/50">
                      <td className="p-3">{player.id}</td>
                      <td className="p-3">{player.username}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 rounded-full text-xs ${player.isActive ? 'bg-status-success/15 text-status-success' : 'bg-status-error/15 text-status-error'}`}>
                          {player.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-3 capitalize">{player.role}</td>
                      <td className="p-3">{formatCurrency(player.balance)}</td>
                      <td className="p-3">{formatDate(player.createdAt)}</td>
                      <td className="p-3">{formatDate(player.lastLogin)}</td>
                      <td className="p-3 space-x-2 whitespace-nowrap">
                        <Button color="primary" size="small" onClick={() => navigate(`/admin/analytics/players/${player.id}`)}>
                          Profile
                        </Button>
                        <Button color="secondary" size="small" onClick={() => handleEditClick(player)}>
                          Edit
                        </Button>
                        <Button color="success" size="small" onClick={() => handleFundClick(player)}>
                          Funds
                        </Button>
                        <Button color="danger" size="small" onClick={() => handleDeleteClick(player)}>
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Pagination controls */}
            <div className="mt-4 flex flex-col sm:flex-row justify-between items-center">
              <div className="mb-3 sm:mb-0">
                <label htmlFor="rows-per-page" className="sr-only">Rows per page</label>
                <select
                  id="rows-per-page"
                  className="p-2 bg-bg-elevated border border-border-light rounded-lg text-text-primary cursor-pointer"
                  value={rowsPerPage}
                  onChange={handleRowsPerPageChange}
                >
                  <option value="10">10 per page</option>
                  <option value="20">20 per page</option>
                  <option value="50">50 per page</option>
                  <option value="100">100 per page</option>
                </select>
                <span className="ml-2">Showing {players.length} of {totalUsers} users</span>
              </div>
              
              <div className="flex space-x-1">
                <Button 
                  color="secondary" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(1)}
                >
                  First
                </Button>
                <Button 
                  color="secondary" 
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                >
                  Previous
                </Button>
                <span className="px-3 py-1 border border-border-light rounded-lg bg-bg-elevated text-text-primary">
                  {currentPage} / {totalPages}
                </span>
                <Button 
                  color="secondary" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                >
                  Next
                </Button>
                <Button 
                  color="secondary" 
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(totalPages)}
                >
                  Last
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
      
      {/* Add Player Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          resetForm();
        }}
        title="Add New Player"
      >
        <form className="space-y-4">
          <div>
            <label htmlFor="add-username" className="block text-sm font-medium text-text-secondary mb-1">Username</label>
            <input
              type="text"
              id="add-username"
              name="username"
              className="w-full p-2 bg-bg-elevated border border-border-light rounded-lg text-text-primary"
              value={formData.username}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label htmlFor="add-email" className="block text-sm font-medium text-text-secondary mb-1">Email</label>
            <input
              type="email"
              id="add-email"
              name="email"
              className="w-full p-2 bg-bg-elevated border border-border-light rounded-lg text-text-primary"
              value={formData.email || ''}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label htmlFor="add-balance" className="block text-sm font-medium text-text-secondary mb-1">Initial Balance</label>
            <input
              type="number"
              id="add-balance"
              name="balance"
              className="w-full p-2 bg-bg-elevated border border-border-light rounded-lg text-text-primary"
              value={formData.balance}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label htmlFor="add-role" className="block text-sm font-medium text-text-secondary mb-1">Role</label>
            <select
              id="add-role"
              name="role"
              className="w-full p-2 bg-bg-elevated border border-border-light rounded-lg text-text-primary cursor-pointer"
              value={formData.role}
              onChange={handleInputChange}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="isActive"
              id="isActive"
              className="mr-2"
              checked={formData.isActive}
              onChange={handleInputChange}
            />
            <label htmlFor="isActive" className="text-sm font-medium text-text-secondary">Active Account</label>
          </div>

          <div className="flex justify-end space-x-3">
            <Button
              color="secondary"
              onClick={() => {
                setShowAddModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button color="success" onClick={handleAddPlayer}>Add Player</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Player Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          resetForm();
        }}
        title="Edit Player"
      >
        <form className="space-y-4">
          <div>
            <label htmlFor="edit-username" className="block text-sm font-medium text-text-secondary mb-1">Username</label>
            <input
              type="text"
              id="edit-username"
              name="username"
              className="w-full p-2 bg-bg-elevated border border-border-light rounded-lg text-text-primary"
              value={formData.username}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label htmlFor="edit-email" className="block text-sm font-medium text-text-secondary mb-1">Email</label>
            <input
              type="email"
              id="edit-email"
              name="email"
              className="w-full p-2 bg-bg-elevated border border-border-light rounded-lg text-text-primary"
              value={formData.email || ''}
              onChange={handleInputChange}
            />
          </div>

          <div>
            <label htmlFor="edit-role" className="block text-sm font-medium text-text-secondary mb-1">Role</label>
            <select
              id="edit-role"
              name="role"
              className="w-full p-2 bg-bg-elevated border border-border-light rounded-lg text-text-primary cursor-pointer"
              value={formData.role}
              onChange={handleInputChange}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              name="isActive"
              id="editIsActive"
              className="mr-2"
              checked={formData.isActive}
              onChange={handleInputChange}
            />
            <label htmlFor="editIsActive" className="text-sm font-medium text-text-secondary">Active Account</label>
          </div>
          
          <div className="flex justify-end space-x-3">
            <Button 
              color="secondary" 
              onClick={() => {
                setShowEditModal(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button color="warning" onClick={handleUpdatePlayer}>Update Player</Button>
          </div>
        </form>
      </Modal>
      
      {/* Fund Management Modal */}
      <Modal
        isOpen={showFundModal}
        onClose={() => {
          setShowFundModal(false);
          setFundAmount(0);
        }}
        title="Manage Funds"
      >
        {currentPlayer && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-text-muted">Current Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(currentPlayer.balance)}</p>
              <p className="text-sm text-text-muted">Player: {currentPlayer.username}</p>
            </div>
            
            <div>
              <label htmlFor="fund-amount" className="block text-sm font-medium text-text-secondary mb-1">Amount</label>
              <input
                type="number"
                id="fund-amount"
                className="w-full p-2 bg-bg-elevated border border-border-light rounded-lg text-text-primary"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            
            <div className="flex justify-center space-x-4">
              <Button color="success" onClick={() => handleFundUpdate('add')}>
                Add Funds
              </Button>
              <Button color="danger" onClick={() => handleFundUpdate('remove')}>
                Remove Funds
              </Button>
            </div>
          </div>
        )}
      </Modal>
      
      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Player"
      >
        {currentPlayer && (
          <div className="space-y-4">
            <p className="text-center">
              Are you sure you want to delete the player <span className="font-bold">{currentPlayer.username}</span>?
            </p>
            <p className="text-center text-sm text-text-muted">
              This action cannot be undone. All player data will be permanently removed.
            </p>
            
            <div className="flex justify-center space-x-4">
              <Button color="secondary" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </Button>
              <Button color="danger" onClick={handleDeletePlayer}>
                Delete Player
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PlayerManagement;