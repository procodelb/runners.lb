import api from './index';

export const transactionsApi = {
  // Get all transactions
  getTransactions: async (params = {}) => {
    const response = await api.get('/transactions', { params });
    return response.data;
  },

  // Get transaction by ID
  getTransaction: async (id) => {
    const response = await api.get(`/transactions/${id}`);
    return response.data;
  },

  // Create transaction
  createTransaction: async (transactionData) => {
    const response = await api.post('/transactions', transactionData);
    return response.data;
  },

  // Update transaction
  updateTransaction: async (id, transactionData) => {
    const response = await api.put(`/transactions/${id}`, transactionData);
    return response.data;
  },

  // Delete transaction
  deleteTransaction: async (id) => {
    const response = await api.delete(`/transactions/${id}`);
    return response.data;
  },

  // Get transactions by actor type
  getTransactionsByActor: async (actorType, actorId, params = {}) => {
    const response = await api.get(`/transactions/actor/${actorType}/${actorId}`, { params });
    return response.data;
  },

  // Get transactions by type
  getTransactionsByType: async (txType, params = {}) => {
    const response = await api.get(`/transactions/type/${txType}`, { params });
    return response.data;
  },

  // Export transactions
  exportTransactions: async (params = {}) => {
    const response = await api.get('/transactions/export', { 
      params,
      responseType: 'blob'
    });
    return response.data;
  },

  // Print transaction receipt
  printReceipt: async (transactionId) => {
    const response = await api.get(`/transactions/${transactionId}/print`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Get transaction statistics
  getTransactionStats: async (params = {}) => {
    const response = await api.get('/transactions/stats', { params });
    return response.data;
  },

  // Bulk create transactions
  bulkCreateTransactions: async (transactions) => {
    const response = await api.post('/transactions/bulk', { transactions });
    return response.data;
  }
};
