import api from '../api';

/**
 * Transaction Service
 * Handles API requests related to financial transactions
 */
class TransactionService {
  /**
   * Get all transactions with pagination and filter options
   * @param {Object} params - Query parameters
   * @returns {Promise} Promise object with transactions data
   */
  async getTransactions(params = {}) {
    try {
      const response = await api.get('/admin/transactions', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  /**
   * Get a single transaction by ID
   * @param {string} transactionId - Transaction ID
   * @returns {Promise} Promise object with transaction data
   */
  async getTransactionById(transactionId) {
    try {
      const response = await api.get(`/admin/transactions/${transactionId}`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching transaction ${transactionId}:`, error);
      throw error;
    }
  }

  /**
   * Get transaction statistics
   * @param {Object} params - Optional parameters like timeRange
   * @returns {Promise} Promise object with transaction statistics
   */
  async getTransactionStats(params = {}) {
    try {
      const response = await api.get('/admin/transactions/stats', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching transaction statistics:', error);
      throw error;
    }
  }

  /**
   * Create a manual transaction (admin initiated)
   * @param {Object} transactionData - Transaction data
   * @returns {Promise} Promise object with created transaction
   */
  async createTransaction(transactionData) {
    try {
      const response = await api.post('/admin/transactions', transactionData);
      return response.data;
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  /**
   * Update transaction status
   * @param {string} transactionId - Transaction ID
   * @param {string} status - New status
   * @returns {Promise} Promise object with updated transaction
   */
  async updateTransactionStatus(transactionId, status) {
    try {
      const response = await api.put(`/admin/transactions/${transactionId}/status`, { status });
      return response.data;
    } catch (error) {
      console.error(`Error updating transaction ${transactionId} status:`, error);
      throw error;
    }
  }

  /**
   * Void or cancel a transaction
   * @param {string} transactionId - Transaction ID
   * @param {string} reason - Reason for voiding
   * @returns {Promise} Promise object with response
   */
  async voidTransaction(transactionId, reason) {
    try {
      const response = await api.post(`/admin/transactions/${transactionId}/void`, { reason });
      return response.data;
    } catch (error) {
      console.error(`Error voiding transaction ${transactionId}:`, error);
      throw error;
    }
  }
}

const transactionService = new TransactionService();
export default transactionService;