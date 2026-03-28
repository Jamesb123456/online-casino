import api from '../api';

/**
 * Transaction Service
 * Handles API requests related to financial transactions
 */
class TransactionService {
  /**
   * Get all transactions with pagination and filter options
   */
  async getTransactions(params = {}) {
    try {
      return await api.get('/admin/transactions', { params });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  /**
   * Create a manual transaction (admin initiated)
   */
  async createTransaction(transactionData) {
    try {
      return await api.post('/admin/transactions', transactionData);
    } catch (error) {
      console.error('Error creating transaction:', error);
      throw error;
    }
  }

  /**
   * Void or cancel a transaction
   */
  async voidTransaction(transactionId, reason) {
    try {
      return await api.put(`/admin/transactions/${transactionId}/void`, { reason });
    } catch (error) {
      console.error(`Error voiding transaction ${transactionId}:`, error);
      throw error;
    }
  }
}

const transactionService = new TransactionService();
export default transactionService;
