import api from './index';

export const orderHistoryApi = {
  // Get order history
  getOrderHistory: async (params = {}) => {
    const response = await api.get('/orders/history', { params });
    return response.data;
  },

  // Get order history by date range
  getOrderHistoryByDateRange: async (startDate, endDate, params = {}) => {
    const response = await api.get('/orders/history', { 
      params: { 
        ...params, 
        start_date: startDate, 
        end_date: endDate 
      } 
    });
    return response.data;
  },

  // Get order history by status
  getOrderHistoryByStatus: async (status, params = {}) => {
    const response = await api.get('/orders/history', { 
      params: { ...params, status } 
    });
    return response.data;
  },

  // Get order history by driver
  getOrderHistoryByDriver: async (driverId, params = {}) => {
    const response = await api.get('/orders/history', { 
      params: { ...params, driver_id: driverId } 
    });
    return response.data;
  },

  // Get order history by client
  getOrderHistoryByClient: async (clientId, params = {}) => {
    const response = await api.get('/orders/history', { 
      params: { ...params, client_id: clientId } 
    });
    return response.data;
  },

  // Export order history
  exportOrderHistory: async (params = {}) => {
    const response = await api.get('/orders/history/export', { 
      params,
      responseType: 'blob'
    });
    return response.data;
  },

  // Get order history statistics
  getOrderHistoryStats: async (params = {}) => {
    const response = await api.get('/orders/history/stats', { params });
    return response.data;
  },

  // Get order history summary
  getOrderHistorySummary: async (params = {}) => {
    const response = await api.get('/orders/history/summary', { params });
    return response.data;
  },

  // Restore order from history
  restoreOrder: async (orderId) => {
    const response = await api.post(`/orders/history/${orderId}/restore`);
    return response.data;
  }
};
