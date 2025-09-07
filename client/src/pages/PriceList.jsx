import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, DollarSign, Plus, Edit, Trash2, Search, Filter, Globe, Save, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../api';

const PriceList = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedPrice, setSelectedPrice] = useState(null);
  const [newPrice, setNewPrice] = useState({
    country: '',
    area: '',
    fee_usd: '',
    fee_lbp: '',
    is_active: true
  });

  const queryClient = useQueryClient();

  const { data: prices, isLoading, error, refetch } = useQuery(
    ['prices'],
    () => api.get('/price-list'),
    {
      refetchOnWindowFocus: false,
      retry: 1,
      select: (response) => response.data?.data || []
    }
  );

  const addPriceMutation = useMutation(
    (data) => api.post('/price-list', data),
    {
      onSuccess: () => {
        toast.success('Price added successfully!');
        setShowAddModal(false);
        setNewPrice({
          country: '',
          area: '',
          fee_usd: '',
          fee_lbp: '',
          is_active: true
        });
        queryClient.invalidateQueries(['prices']);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to add price');
      }
    }
  );

  const updatePriceMutation = useMutation(
    ({ id, data }) => api.put(`/price-list/${id}`, data),
    {
      onSuccess: () => {
        toast.success('Price updated successfully!');
        setShowEditModal(false);
        setSelectedPrice(null);
        queryClient.invalidateQueries(['prices']);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update price');
      }
    }
  );

  const deletePriceMutation = useMutation(
    (id) => api.delete(`/price-list/${id}`),
    {
      onSuccess: () => {
        toast.success('Price deleted successfully!');
        queryClient.invalidateQueries(['prices']);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete price');
      }
    }
  );

  const togglePriceStatusMutation = useMutation(
    ({ id, is_active }) => api.patch(`/price-list/${id}/toggle-status`, { is_active }),
    {
      onSuccess: () => {
        toast.success('Price status updated successfully!');
        queryClient.invalidateQueries(['prices']);
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update price status');
      }
    }
  );

  const handleAddPrice = () => {
    if (!newPrice.country || !newPrice.area || (!newPrice.fee_usd && !newPrice.fee_lbp)) {
      toast.error('Please fill in all required fields');
      return;
    }
    addPriceMutation.mutate(newPrice);
  };

  const handleEditPrice = () => {
    if (!selectedPrice.country || !selectedPrice.area || (!selectedPrice.fee_usd && !selectedPrice.fee_lbp)) {
      toast.error('Please fill in all required fields');
      return;
    }
    updatePriceMutation.mutate({
      id: selectedPrice.id,
      data: selectedPrice
    });
  };

  const handleDeletePrice = (id) => {
    if (window.confirm('Are you sure you want to delete this price?')) {
      deletePriceMutation.mutate(id);
    }
  };

  const handleToggleStatus = (id, currentStatus) => {
    togglePriceStatusMutation.mutate({
      id,
      is_active: !currentStatus
    });
  };

  const openEditModal = (price) => {
    setSelectedPrice({ ...price });
    setShowEditModal(true);
  };

  const filteredPrices = prices?.data?.filter(price => {
    const matchesSearch = price.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         price.area.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCountry = !filterCountry || price.country === filterCountry;
    return matchesSearch && matchesCountry;
  }) || [];

  const countries = [...new Set((prices || []).map(price => price.country))];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">Error loading price list</p>
        <button 
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Price List</h1>
          <p className="text-gray-600 mt-2">Manage delivery fees for different countries and areas</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Price</span>
          </button>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
      >
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="h-5 w-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by country or area..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Country
            </label>
            <select
              value={filterCountry}
              onChange={(e) => setFilterCountry(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Countries</option>
              {countries.map(country => (
                <option key={country} value={country}>{country}</option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('');
                setFilterCountry('');
              }}
              className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </motion.div>

      {/* Price List */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fees
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <AnimatePresence>
                {(filteredPrices || []).map((price, index) => (
                  <motion.tr
                    key={price.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                            <Globe className="h-4 w-4 text-blue-600" />
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{price.country}</div>
                          <div className="text-sm text-gray-500 flex items-center">
                            <MapPin className="h-3 w-3 mr-1" />
                            {price.area}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="space-y-1">
                        {price.fee_usd > 0 && (
                          <div className="flex items-center space-x-2">
                            <DollarSign className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-gray-900">
                              ${price.fee_usd.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {price.fee_lbp > 0 && (
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">
                              {price.fee_lbp.toLocaleString()} LBP
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(price.id, price.is_active)}
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full transition-colors ${
                          price.is_active
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        }`}
                      >
                        {price.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openEditModal(price)}
                          className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeletePrice(price.id)}
                          className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        
        {filteredPrices.length === 0 && (
          <div className="text-center py-12">
            <Globe className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No prices found</p>
            <p className="text-gray-400 text-sm">Try adjusting your filters or add a new price</p>
          </div>
        )}
      </motion.div>

      {/* Add Price Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Add New Price
                </h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Lebanon, UAE, Saudi Arabia"
                    value={newPrice.country}
                    onChange={(e) => setNewPrice(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Area *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Beirut, Dubai, Riyadh"
                    value={newPrice.area}
                    onChange={(e) => setNewPrice(prev => ({ ...prev, area: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fee USD
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newPrice.fee_usd}
                      onChange={(e) => setNewPrice(prev => ({ ...prev, fee_usd: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fee LBP
                    </label>
                    <input
                      type="number"
                      placeholder="0"
                      value={newPrice.fee_lbp}
                      onChange={(e) => setNewPrice(prev => ({ ...prev, fee_lbp: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_active"
                    checked={newPrice.is_active}
                    onChange={(e) => setNewPrice(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                    Active
                  </label>
                </div>
              </div>
              
              <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddPrice}
                  disabled={addPriceMutation.isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{addPriceMutation.isLoading ? 'Adding...' : 'Add Price'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Price Modal */}
      {showEditModal && selectedPrice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-lg shadow-xl max-w-md w-full"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Edit Price
                </h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country *
                  </label>
                  <input
                    type="text"
                    value={selectedPrice.country}
                    onChange={(e) => setSelectedPrice(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Area *
                  </label>
                  <input
                    type="text"
                    value={selectedPrice.area}
                    onChange={(e) => setSelectedPrice(prev => ({ ...prev, area: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fee USD
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={selectedPrice.fee_usd}
                      onChange={(e) => setSelectedPrice(prev => ({ ...prev, fee_usd: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fee LBP
                    </label>
                    <input
                      type="number"
                      value={selectedPrice.fee_lbp}
                      onChange={(e) => setSelectedPrice(prev => ({ ...prev, fee_lbp: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="edit_is_active"
                    checked={selectedPrice.is_active}
                    onChange={(e) => setSelectedPrice(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="edit_is_active" className="ml-2 block text-sm text-gray-900">
                    Active
                  </label>
                </div>
              </div>
              
              <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditPrice}
                  disabled={updatePriceMutation.isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center space-x-2"
                >
                  <Save className="h-4 w-4" />
                  <span>{updatePriceMutation.isLoading ? 'Updating...' : 'Update Price'}</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default PriceList;
