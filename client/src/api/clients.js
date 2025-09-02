import api from './index';

export const clientsApi = {
  // Get all clients
  getAll: async () => {
    const response = await api.get('/crm');
    return response.data;
  },

  // Get client by ID
  getById: async (id) => {
    const response = await api.get(`/crm/${id}`);
    return response.data;
  },

  // Create new client
  create: async (clientData) => {
    const response = await api.post('/crm', clientData);
    return response.data;
  },

  // Update client
  update: async (id, clientData) => {
    const response = await api.put(`/crm/${id}`, clientData);
    return response.data;
  },

  // Delete client
  delete: async (id) => {
    const response = await api.delete(`/crm/${id}`);
    return response.data;
  },

  // Search clients
  search: async (query) => {
    const response = await api.get(`/crm/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },

  // Get client by phone
  getByPhone: async (phone) => {
    const response = await api.get(`/crm/phone/${encodeURIComponent(phone)}`);
    return response.data;
  },

  // Get client by business name
  getByBusinessName: async (businessName) => {
    const response = await api.get(`/crm/business/${encodeURIComponent(businessName)}`);
    return response.data;
  }
};

