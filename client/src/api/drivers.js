import api from './index';

export const driversApi = {
  // Get all drivers
  getAll: async () => {
    const response = await api.get('/drivers');
    return response.data;
  },

  // Alias for getAll to match the expected function name
  getDrivers: async () => {
    const response = await api.get('/drivers');
    return response.data?.data || []; // Return the data array directly
  },

  // Get driver by ID
  getById: async (id) => {
    const response = await api.get(`/drivers/${id}`);
    return response.data;
  },

  // Create new driver
  create: async (driverData) => {
    const response = await api.post('/drivers', driverData);
    return response.data;
  },

  // Update driver
  update: async (id, driverData) => {
    const response = await api.put(`/drivers/${id}`, driverData);
    return response.data;
  },

  // Delete driver
  delete: async (id) => {
    const response = await api.delete(`/drivers/${id}`);
    return response.data;
  },

  // Get driver fees
  getFees: async (id) => {
    const response = await api.get(`/drivers/${id}/fees`);
    return response.data;
  },

  // Add driver fee
  addFee: async (id, feeData) => {
    const response = await api.post(`/drivers/${id}/fees`, feeData);
    return response.data;
  },

  // Get driver advances
  getAdvances: async (id) => {
    const response = await api.get(`/drivers/${id}/advances`);
    return response.data;
  },

  // Add driver advance
  addAdvance: async (id, advanceData) => {
    const response = await api.post(`/drivers/${id}/advances`, advanceData);
    return response.data;
  },

  // Search drivers
  search: async (query) => {
    const response = await api.get(`/drivers/search?q=${encodeURIComponent(query)}`);
    return response.data;
  }
};

