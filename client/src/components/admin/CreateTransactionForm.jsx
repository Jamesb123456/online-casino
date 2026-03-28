import React, { useState, useEffect } from 'react';
import adminService from '../../services/admin/adminService';
import transactionService from '../../services/admin/transactionService';

/**
 * Form for creating manual transactions by admins
 */
const CreateTransactionForm = ({ onTransactionCreated }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState({
    userId: '',
    type: 'deposit',
    amount: '',
    reference: ''
  });

  // Load users for dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await adminService.getPlayers();
        const userData = response.players || response;
        setUsers(userData);
      } catch (err) {
        setError('Failed to load users');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Basic validation
    if (!formData.userId || !formData.type || !formData.amount) {
      setError('Please fill all required fields');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Create the transaction
      const result = await transactionService.createTransaction({
        userId: formData.userId,
        type: formData.type,
        amount: parseFloat(formData.amount),
        reference: formData.reference || 'Admin manual transaction'
      });

      // Reset form
      setFormData({
        userId: '',
        type: 'deposit',
        amount: '',
        reference: ''
      });

      setSuccess('Transaction created successfully');

      // Notify parent component
      if (onTransactionCreated) {
        onTransactionCreated(result.transaction);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create transaction');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-bg-card rounded-xl p-6 shadow-card border border-border">
      <h2 className="text-xl font-semibold text-text-primary mb-4">Create Transaction</h2>

      {error && (
        <div className="bg-status-error/10 border border-status-error/20 text-status-error p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-status-success/10 border border-status-success/20 text-status-success p-3 rounded-lg mb-4">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="mb-4">
            <label className="block text-text-secondary mb-2" htmlFor="userId">
              User
            </label>
            <select
              id="userId"
              name="userId"
              value={formData.userId}
              onChange={handleChange}
              className="w-full bg-bg-elevated text-text-primary rounded-lg p-2 border border-border-light focus:outline-none focus:ring-2 focus:ring-accent-gold/50 cursor-pointer"
              disabled={loading}
              required
            >
              <option value="">Select User</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username} ({user.email || user.role})
                </option>
              ))}
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-text-secondary mb-2" htmlFor="type">
              Transaction Type
            </label>
            <select
              id="type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="w-full bg-bg-elevated text-text-primary rounded-lg p-2 border border-border-light focus:outline-none focus:ring-2 focus:ring-accent-gold/50 cursor-pointer"
              disabled={loading}
              required
            >
              <option value="deposit">Deposit</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="admin_adjustment">Balance Adjustment</option>
            </select>
          </div>

          <div className="mb-4">
            <label className="block text-text-secondary mb-2" htmlFor="amount">
              Amount
            </label>
            <input
              type="number"
              step="0.01"
              id="amount"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              placeholder="Enter amount"
              className="w-full bg-bg-elevated text-text-primary rounded-lg p-2 border border-border-light focus:outline-none focus:ring-2 focus:ring-accent-gold/50"
              disabled={loading}
              required
            />
            <small className="text-text-muted mt-1 block">
              Use negative values for withdrawals
            </small>
          </div>

          <div className="mb-4">
            <label className="block text-text-secondary mb-2" htmlFor="reference">
              Reference/Note
            </label>
            <input
              type="text"
              id="reference"
              name="reference"
              value={formData.reference}
              onChange={handleChange}
              placeholder="Enter reference or note"
              className="w-full bg-bg-elevated text-text-primary rounded-lg p-2 border border-border-light focus:outline-none focus:ring-2 focus:ring-accent-gold/50"
              disabled={loading}
            />
          </div>
        </div>

        <div className="mt-4">
          <button
            type="submit"
            className="px-4 py-2 bg-accent-purple hover:bg-violet-600 text-white rounded-lg disabled:opacity-50 cursor-pointer transition-colors"
            disabled={loading}
          >
            {loading ? 'Processing...' : 'Create Transaction'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateTransactionForm;
