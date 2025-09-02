import api from './index';

export const cashboxApi = {
  // Get cashbox overview with balances
  getOverview: async () => {
    const response = await api.get('/cashbox');
    return response.data;
  },

  // Get cashbox entries with pagination and filtering
  getEntries: async ({ page = 1, type = 'all', search = '' }) => {
    const params = new URLSearchParams({
      page: page.toString(),
      type,
      search
    });
    const response = await api.get(`/cashbox/entries?${params}`);
    return response.data;
  },

  // Add a new cashbox entry
  addEntry: async (entryData) => {
    const response = await api.post('/cashbox/entry', entryData);
    return response.data;
  },

  // Add driver advance
  addDriverAdvance: async (advanceData) => {
    const response = await api.post('/cashbox/driver-advance', advanceData);
    return response.data;
  },

  // Add driver return
  addDriverReturn: async (returnData) => {
    const response = await api.post('/cashbox/driver-return', returnData);
    return response.data;
  },

  // Delete a cashbox entry
  deleteEntry: async (entryId) => {
    const response = await api.delete(`/cashbox/entry/${entryId}`);
    return response.data;
  },

  // Get cashbox balance
  getBalance: async () => {
    const response = await api.get('/cashbox/balance');
    return response.data;
  },

  // Get cashbox history
  getHistory: async ({ from, to, type }) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (type) params.append('type', type);
    
    const response = await api.get(`/cashbox/history?${params}`);
    return response.data;
  },

  // Export cashbox data
  exportData: async ({ format = 'pdf', from, to }) => {
    const params = new URLSearchParams({
      format,
      ...(from && { from }),
      ...(to && { to })
    });
    
    const response = await api.get(`/cashbox/export?${params}`, {
      responseType: 'blob'
    });
    return response.data;
  }
};

