import api from './index';

export const customersApi = {
  // Get all customers
  getAll: async () => {
    const response = await api.get('/customers');
    return response.data;
  },

  // Get customer by phone
  getByPhone: async (phone) => {
    const response = await api.get(`/customers/${phone}`);
    return response.data;
  },

  // Search customers
  search: async (term) => {
    const response = await api.get(`/customers/search/${term}`);
    return response.data;
  },

  // Create or update customer
  createOrUpdate: async (customerData) => {
    const response = await api.post('/customers', customerData);
    return response.data;
  },

  // Update customer
  update: async (phone, customerData) => {
    const response = await api.put(`/customers/${phone}`, customerData);
    return response.data;
  },

  // Delete customer
  delete: async (phone) => {
    const response = await api.delete(`/customers/${phone}`);
    return response.data;
  },

  // Get or create customer (for order forms)
  getOrCreate: async (customerData) => {
    const response = await api.post('/customers/get-or-create', customerData);
    return response.data;
  }
};
