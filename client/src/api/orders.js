import api from './index';

export const ordersApi = {
  // Get all orders with filters
  getOrders: async (params = {}) => {
    const response = await api.get('/orders', { params });
    return response.data;
  },

  // Get single order by ID
  getOrder: async (id) => {
    const response = await api.get(`/orders/${id}`);
    return response.data;
  },

  // Create new order
  createOrder: async (orderData) => {
    const response = await api.post('/orders', orderData);
    return response.data;
  },

  // Update order
  updateOrder: async (id, orderData) => {
    const response = await api.put(`/orders/${id}`, orderData);
    return response.data;
  },

  // Delete order
  deleteOrder: async (id) => {
    const response = await api.delete(`/orders/${id}`);
    return response.data;
  },

  // Assign driver to order
  assignDriver: async (orderId, driverData) => {
    const response = await api.post(`/orders/${orderId}/assign-driver`, driverData);
    return response.data;
  },

  // Complete order
  completeOrder: async (orderId) => {
    const response = await api.post(`/orders/${orderId}/complete`);
    return response.data;
  },

  // Get order history
  getOrderHistory: async (params = {}) => {
    const response = await api.get('/orders/history', { params });
    return response.data;
  },

  // Export orders
  exportOrders: async (params = {}) => {
    const response = await api.get('/orders/export', { 
      params,
      responseType: 'blob'
    });
    return response.data;
  },

  // Bulk update orders
  bulkUpdateOrders: async (orderIds, updateData) => {
    const response = await api.put('/orders/bulk-update', {
      orderIds,
      updateData
    });
    return response.data;
  },

  // Batch create orders
  batchCreate: async (orders) => {
    const response = await api.post('/orders/batch', { orders });
    return response.data;
  },

  // Bulk assign driver
  bulkAssignDriver: async (orderIds, driverId) => {
    const response = await api.patch('/orders/assign', { order_ids: orderIds, driver_id: driverId });
    return response.data;
  },

  // Get order statistics
  getOrderStats: async () => {
    const response = await api.get('/orders/stats');
    return response.data;
  }
};
