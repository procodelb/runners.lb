import api from './index';

const accountingAPI = {
  // Get accounting overview data
  getOverview: async (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    
    const response = await api.get(`/accounting/overview?${queryParams}`);
    return response.data;
  },

  // Get clients accounting data
  getClients: async (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    
    const response = await api.get(`/accounting/clients?${queryParams}`);
    return response.data;
  },

  // Get drivers accounting data
  getDrivers: async (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    
    const response = await api.get(`/accounting/drivers?${queryParams}`);
    return response.data;
  },

  // Get third-party accounting data
  getThirdParty: async (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    
    const response = await api.get(`/accounting/thirdparty?${queryParams}`);
    return response.data;
  },

  // Record payment
  recordPayment: async (paymentData) => {
    const response = await api.post('/accounting/payments', paymentData);
    return response.data;
  },

  // Update order status
  updateOrderStatus: async (orderId, status) => {
    const response = await api.put(`/accounting/orders/${orderId}/status`, { status });
    return response.data;
  },

  // Get exchange rates
  getExchangeRates: async () => {
    const response = await api.get('/accounting/exchange-rates');
    return response.data;
  },

  // Update exchange rate
  updateExchangeRate: async (date, rate) => {
    const response = await api.post('/accounting/exchange-rates', { date, usd_to_lbp_rate: rate });
    return response.data;
  },

  // Export client statement
  exportClientStatement: async (clientId, params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    
    const response = await api.get(`/accounting/export/client-statement/${clientId}?${queryParams}`, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Bulk operations
  bulkMarkPaid: async (orderIds) => {
    const response = await api.post('/accounting/bulk/mark-paid', { orderIds });
    return response.data;
  },

  bulkExport: async (orderIds, format = 'csv') => {
    const response = await api.post('/accounting/bulk/export', { orderIds, format });
    return response.data;
  },

  // Get account balances
  getAccountBalances: async (accountType, accountId) => {
    const response = await api.get(`/accounting/balances/${accountType}/${accountId}`);
    return response.data;
  },

  // Create account adjustment
  createAccountAdjustment: async (adjustmentData) => {
    const response = await api.post('/accounting/adjustments', adjustmentData);
    return response.data;
  },

  // Get driver advances
  getDriverAdvances: async (driverId) => {
    const response = await api.get(`/accounting/driver-advances/${driverId}`);
    return response.data;
  },

  // Clear driver advance
  clearDriverAdvance: async (advanceId) => {
    const response = await api.put(`/accounting/driver-advances/${advanceId}/clear`);
    return response.data;
  },

  // Get cashbox entries
  getCashboxEntries: async (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    
    const response = await api.get(`/accounting/cashbox-entries?${queryParams}`);
    return response.data;
  },

  // Create cashbox entry
  createCashboxEntry: async (entryData) => {
    const response = await api.post('/accounting/cashbox-entries', entryData);
    return response.data;
  },

  // Get audit log
  getAuditLog: async (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    
    const response = await api.get(`/accounting/audit-log?${queryParams}`);
    return response.data;
  }
};

export default accountingAPI;
