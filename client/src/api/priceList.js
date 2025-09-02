import api from './index';

export const priceListApi = {
  // Get all price list items
  getPriceList: async (params = {}) => {
    const response = await api.get('/price-list', { params });
    return response.data;
  },

  // Get price list item by ID
  getPriceListItem: async (id) => {
    const response = await api.get(`/price-list/${id}`);
    return response.data;
  },

  // Create price list item
  createPriceListItem: async (itemData) => {
    const response = await api.post('/price-list', itemData);
    return response.data;
  },

  // Update price list item
  updatePriceListItem: async (id, itemData) => {
    const response = await api.put(`/price-list/${id}`, itemData);
    return response.data;
  },

  // Delete price list item
  deletePriceListItem: async (id) => {
    const response = await api.delete(`/price-list/${id}`);
    return response.data;
  },

  // Get price list by country
  getPriceListByCountry: async (country, params = {}) => {
    const response = await api.get(`/price-list/country/${country}`, { params });
    return response.data;
  },

  // Get price list by area
  getPriceListByArea: async (area, params = {}) => {
    const response = await api.get(`/price-list/area/${area}`, { params });
    return response.data;
  },

  // Bulk update price list
  bulkUpdatePriceList: async (updates) => {
    const response = await api.put('/price-list/bulk-update', { updates });
    return response.data;
  },

  // Export price list
  exportPriceList: async (params = {}) => {
    const response = await api.get('/price-list/export', { 
      params,
      responseType: 'blob'
    });
    return response.data;
  },

  // Import price list
  importPriceList: async (fileData) => {
    const response = await api.post('/price-list/import', fileData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  // Get price list statistics
  getPriceListStats: async () => {
    const response = await api.get('/price-list/stats');
    return response.data;
  }
};
