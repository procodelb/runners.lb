import api from './index';

export const cashboxApi = {
  // Get cashbox overview with balances
  getOverview: async () => {
    const response = await api.get('/cashbox');
    return response.data;
  },

  // Get cashbox balance
  getBalance: async () => {
    const response = await api.get('/cashbox/balance');
    return response.data;
  },

  // Get cashbox timeline/history
  getTimeline: async ({ limit = 10, offset = 0, type = 'all' }) => {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      type
    });
    const response = await api.get(`/cashbox/timeline?${params}`);
    return response.data;
  },

  // Set initial capital
  setCapital: async (capitalData) => {
    const response = await api.post('/cashbox/capital', capitalData);
    return response.data;
  },

  // Edit capital
  editCapital: async (capitalData) => {
    const response = await api.put('/cashbox/capital', capitalData);
    return response.data;
  },

  // Add income
  addIncome: async (incomeData) => {
    const response = await api.post('/cashbox/income', incomeData);
    return response.data;
  },

  // Add expense
  addExpense: async (expenseData) => {
    const response = await api.post('/cashbox/expense', expenseData);
    return response.data;
  },

  // Expense capital (remove from cash or wish)
  expenseCapital: async (capitalData) => {
    const response = await api.post('/cashbox/expense-capital', capitalData);
    return response.data;
  },

  // Get expense categories
  getExpenseCategories: async () => {
    const response = await api.get('/cashbox/expense-categories');
    return response.data;
  },

  // Transfer between accounts
  transfer: async (transferData) => {
    const response = await api.post('/cashbox/transfer', transferData);
    return response.data;
  },

  // Get detailed report
  getReport: async ({ from, to, account_type = 'all' }) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (account_type !== 'all') params.append('account_type', account_type);
    
    const response = await api.get(`/cashbox/report?${params}`);
    return response.data;
  },

  // Legacy methods for backward compatibility
  getEntries: async ({ page = 1, type = 'all', search = '' }) => {
    const params = new URLSearchParams({
      limit: '10',
      offset: ((page - 1) * 10).toString(),
      type
    });
    const response = await api.get(`/cashbox/timeline?${params}`);
    return response.data;
  },

  // Add a new cashbox entry (legacy)
  addEntry: async (entryData) => {
    // Map to new income/expense endpoints based on entry type
    if (entryData.entry_type === 'income' || entryData.entry_type === 'cash_in') {
      return await api.post('/cashbox/income', entryData);
    } else if (entryData.entry_type === 'expense' || entryData.entry_type === 'cash_out') {
      return await api.post('/cashbox/expense', entryData);
    } else {
      // For other types, use generic endpoint if needed
      const response = await api.post('/cashbox/entry', entryData);
      return response.data;
    }
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

  // Get cashbox history (legacy)
  getHistory: async ({ from, to, type }) => {
    return await this.getReport({ from, to, account_type: type });
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

export default cashboxApi;