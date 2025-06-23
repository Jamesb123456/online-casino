import React, { useState, useEffect } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import adminService from '../../services/admin/adminService';

/**
 * Player Management Component
 * Provides interface for administrators to manage players
 */
const PlayerManagement = () => {
  // State for players data
  const [players, setPlayers] = useState([]);
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
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
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const response = await adminService.getPlayers();
        if (response.players) {
          setPlayers(response.players);
          setFilteredPlayers(response.players);
        } else {
          // Fallback to mock data if API not available during development
          const mockPlayers = [
            { id: 1, username: 'player123', email: 'player123@example.com', balance: 1500.25, gamesPlayed: 45, role: 'player', isActive: true },
            { id: 2, username: 'gambler456', email: 'gambler456@example.com', balance: 750.50, gamesPlayed: 23, role: 'player', isActive: true },
            { id: 3, username: 'luckywin789', email: 'lucky789@example.com', balance: 2300.75, gamesPlayed: 78, role: 'vip', isActive: true },
            { id: 4, username: 'highroller22', email: 'highroller@example.com', balance: 5000.00, gamesPlayed: 132, role: 'vip', isActive: true },
            { id: 5, username: 'inactive_user', email: 'inactive@example.com', balance: 0.00, gamesPlayed: 5, role: 'player', isActive: false },
          ];
          
          setPlayers(mockPlayers);
          setFilteredPlayers(mockPlayers);
          console.warn('Using mock player data as API returned unexpected format');
        }
      } catch (error) {
        console.error('Error fetching players:', error);
        // Fallback to mock data if API not available
        const mockPlayers = [
          { id: 1, username: 'player123', email: 'player123@example.com', balance: 1500.25, gamesPlayed: 45, role: 'player', isActive: true },
          { id: 2, username: 'gambler456', email: 'gambler456@example.com', balance: 750.50, gamesPlayed: 23, role: 'player', isActive: true },
          { id: 3, username: 'luckywin789', email: 'lucky789@example.com', balance: 2300.75, gamesPlayed: 78, role: 'vip', isActive: true },
          { id: 4, username: 'highroller22', email: 'highroller@example.com', balance: 5000.00, gamesPlayed: 132, role: 'vip', isActive: true },
          { id: 5, username: 'inactive_user', email: 'inactive@example.com', balance: 0.00, gamesPlayed: 5, role: 'player', isActive: false },
        ];
        
        setPlayers(mockPlayers);
        setFilteredPlayers(mockPlayers);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlayers();
  }, []);
  
  // Filter players based on search term
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredPlayers(players);
      return;
    }
    
    const filtered = players.filter(player => 
      player.username.toLowerCase().includes(searchTerm.toLowerCase()) || 
      player.email.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredPlayers(filtered);
  }, [searchTerm, players]);
  
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
  
  // CRUD operations - in a real app these would make API calls
  
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
        setPlayers(prev => [...prev, response.player]);
        setFilteredPlayers(prev => [...prev, response.player]);
      } else {
        // Fallback if API response format is unexpected
        const newPlayer = {
          id: players.length + 1,
          ...formData,
          balance: parseFloat(formData.balance),
          gamesPlayed: 0
        };
        setPlayers(prev => [...prev, newPlayer]);
        setFilteredPlayers(prev => [...prev, newPlayer]);
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
      const response = await adminService.updatePlayer(currentPlayer.id, formData);
      
      if (response && response.player) {
        const updatedPlayers = players.map(player => 
          player.id === currentPlayer.id ? response.player : player
        );
        setPlayers(updatedPlayers);
        setFilteredPlayers(
          filteredPlayers.map(player => 
            player.id === currentPlayer.id ? response.player : player
          )
        );
      } else {
        // Fallback if API response is unexpected
        const updatedPlayers = players.map(player => 
          player.id === currentPlayer.id ? { ...player, ...formData } : player
        );
        setPlayers(updatedPlayers);
        setFilteredPlayers(
          filteredPlayers.map(player => 
            player.id === currentPlayer.id ? { ...player, ...formData } : player
          )
        );
      }
      
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
      let response;
      
      if (operation === 'add') {
        response = await adminService.addFunds(currentPlayer.id, amount);
      } else {
        response = await adminService.removeFunds(currentPlayer.id, amount);
      }
      
      if (response && response.player) {
        // Update local state with API response
        const updatedPlayers = players.map(player => 
          player.id === currentPlayer.id ? response.player : player
        );
        setPlayers(updatedPlayers);
        setFilteredPlayers(
          filteredPlayers.map(player => 
            player.id === currentPlayer.id ? response.player : player
          )
        );
      } else {
        // Fallback if API response is unexpected
        const updatedPlayers = players.map(player => {
          if (player.id === currentPlayer.id) {
            const newBalance = operation === 'add' 
              ? player.balance + amount 
              : Math.max(0, player.balance - amount);
              
            return { ...player, balance: newBalance };
          }
          return player;
        });
        
        setPlayers(updatedPlayers);
        setFilteredPlayers(
          filteredPlayers.map(player => {
            if (player.id === currentPlayer.id) {
              const newBalance = operation === 'add' 
                ? player.balance + amount 
                : Math.max(0, player.balance - amount);
                
              return { ...player, balance: newBalance };
            }
            return player;
          })
        );
      }
      
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
      
      // Update local state after successful API call
      const updatedPlayers = players.filter(player => player.id !== currentPlayer.id);
      setPlayers(updatedPlayers);
      setFilteredPlayers(filteredPlayers.filter(player => player.id !== currentPlayer.id));
      
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
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Player Management</h1>
        <Button 
          color="success"
          className="flex items-center" 
          onClick={() => setShowAddModal(true)}
        >
          <FaPlus className="mr-2" /> Add Player
        </Button>
      </div>
      
      <Card className="bg-gray-800 text-white">
        <div className="flex justify-between items-center mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <FaSearch className="text-gray-400" />
            </div>
            <input
              type="text"
              className="pl-10 p-2 bg-gray-700 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="text-gray-400">
            Showing {filteredPlayers.length} of {players.length} players
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="py-3 px-4">Username</th>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Balance</th>
                  <th className="py-3 px-4">Games</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.map((player) => (
                  <tr key={player.id} className="border-b border-gray-700 hover:bg-gray-700">
                    <td className="py-3 px-4">{player.username}</td>
                    <td className="py-3 px-4">{player.email}</td>
                    <td className="py-3 px-4">{formatCurrency(player.balance)}</td>
                    <td className="py-3 px-4">{player.gamesPlayed}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        player.role === 'vip' ? 'bg-purple-900 text-purple-200' : 'bg-blue-900 text-blue-200'
                      }`}>
                        {player.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        player.isActive ? 'bg-green-900 text-green-200' : 'bg-red-900 text-red-200'
                      }`}>
                        {player.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button 
                        color="primary" 
                        size="sm" 
                        className="mr-2"
                        onClick={() => handleFundClick(player)}
                      >
                        <FaCoins />
                      </Button>
                      <Button 
                        color="warning" 
                        size="sm"
                        className="mr-2"
                        onClick={() => handleEditClick(player)}
                      >
                        <FaEdit />
                      </Button>
                      <Button 
                        color="danger" 
                        size="sm" 
                        onClick={() => handleDeleteClick(player)}
                      >
                        <FaTrash />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
            <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
            <input
              type="text"
              name="username"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
              value={formData.username}
              onChange={handleInputChange}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              type="email"
              name="email"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
              value={formData.email}
              onChange={handleInputChange}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Initial Balance</label>
            <input
              type="number"
              name="balance"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
              value={formData.balance}
              onChange={handleInputChange}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
            <select
              name="role"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
              value={formData.role}
              onChange={handleInputChange}
            >
              <option value="player">Player</option>
              <option value="vip">VIP</option>
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
            <label htmlFor="isActive" className="text-sm font-medium text-gray-300">Active Account</label>
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
            <label className="block text-sm font-medium text-gray-300 mb-1">Username</label>
            <input
              type="text"
              name="username"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
              value={formData.username}
              onChange={handleInputChange}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
            <input
              type="email"
              name="email"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
              value={formData.email}
              onChange={handleInputChange}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
            <select
              name="role"
              className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
              value={formData.role}
              onChange={handleInputChange}
            >
              <option value="player">Player</option>
              <option value="vip">VIP</option>
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
            <label htmlFor="editIsActive" className="text-sm font-medium text-gray-300">Active Account</label>
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
              <p className="text-gray-400">Current Balance</p>
              <p className="text-2xl font-bold">{formatCurrency(currentPlayer.balance)}</p>
              <p className="text-sm text-gray-400">Player: {currentPlayer.username}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Amount</label>
              <input
                type="number"
                className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
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
            <p className="text-center text-sm text-gray-400">
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