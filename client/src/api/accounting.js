import api from './index';

export async function fetchEntities(params = {}) {
  const { data } = await api.get('/accounting/entities', { params });
  return data;
}

export async function fetchEntityOrders(type, id, params = {}) {
  const { data } = await api.get(`/accounting/${type}/${id}/orders`, { params });
  return data;
}

export async function cashoutOrder(orderId, mode) {
  const { data } = await api.post('/accounting/cashout', { orderId, mode });
  return data;
}

export const accountingApi = {
  // Get all transactions
  getTransactions: async (params = {}) => {
    const response = await api.get('/accounting/transactions', { params });
    return response.data;
  },

  // Get transaction by ID
  getTransaction: async (id) => {
    const response = await api.get(`/accounting/transactions/${id}`);
    return response.data;
  },

  // Create transaction
  createTransaction: async (transactionData) => {
    const response = await api.post('/accounting/transactions', transactionData);
    return response.data;
  },

  // Update transaction
  updateTransaction: async (id, transactionData) => {
    const response = await api.put(`/accounting/transactions/${id}`, transactionData);
    return response.data;
  },

  // Delete transaction
  deleteTransaction: async (id) => {
    const response = await api.delete(`/accounting/transactions/${id}`);
    return response.data;
  },

  // Get financial reports
  getReports: async (params = {}) => {
    const response = await api.get('/accounting/reports', { params });
    return response.data;
  },

  // Get account balances
  getBalances: async () => {
    const response = await api.get('/accounting/balances');
    return response.data;
  },

  // Export accounting data
  exportData: async (params = {}) => {
    const response = await api.get('/accounting/export', { 
      params,
      responseType: 'blob'
    });
    return response.data;
  },

  // Get client ledger
  getClientLedger: async (clientId, params = {}) => {
    const response = await api.get(`/accounting/clients/${clientId}/ledger`, { params });
    return response.data;
  },

  // Get driver ledger
  getDriverLedger: async (driverId, params = {}) => {
    const response = await api.get(`/accounting/drivers/${driverId}/ledger`, { params });
    return response.data;
  },

  // Get third party ledger
  getThirdPartyLedger: async (thirdPartyId, params = {}) => {
    const response = await api.get(`/accounting/third-parties/${thirdPartyId}/ledger`, { params });
    return response.data;
  },

  // Print receipt
  printReceipt: async (transactionId) => {
    const response = await api.get(`/accounting/transactions/${transactionId}/print`, {
      responseType: 'blob'
    });
    return response.data;
  }
};

// Helper for price-list search used by Add Order flows when needed in accounting context
export async function fetchPriceListSearch(q) {
  const { data } = await api.get('/price-list/search', { params: { q } });
  return data;
}
