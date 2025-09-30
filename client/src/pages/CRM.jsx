import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  MapPin, 
  Phone, 
  Globe, 
  Instagram,
  Building2,
  User,
  X,
  Save,
  Loader2,
  Map
} from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

const CRM = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [formData, setFormData] = useState({
    business_name: '',
    contact_person: '',
    phone: '',
    address: '',
    instagram: '',
    website: '',
    google_map_link: '',
    category: ''
  });
  const [customCategory, setCustomCategory] = useState('');

  const queryClient = useQueryClient();

  // Fetch clients with search and filter
  const { data: clients, isLoading } = useQuery(
    ['clients', searchTerm, selectedCategory],
    () => api.get(`/clients?search=${searchTerm}&category=${selectedCategory}`),
    {
      keepPreviousData: true,
      select: (response) => response.data?.data || []
    }
  );

  // Search clients for autocomplete (used by Orders page)
  const searchClients = async (query) => {
    try {
      const response = await api.get(`/clients/search/${encodeURIComponent(query)}`);
      return response.data?.data || [];
    } catch (error) {
      console.error('Error searching clients:', error);
      return [];
    }
  };

  // Add new client mutation
  const addClientMutation = useMutation(
    (newClient) => api.post('/clients', newClient),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('clients');
        setShowAddModal(false);
        resetForm();
        toast.success('Client added successfully!');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || error.message || 'Failed to add client';
        toast.error(errorMessage);
        console.error('Add client error:', error);
      }
    }
  );

  // Update client mutation
  const updateClientMutation = useMutation(
    ({ id, clientData }) => api.put(`/clients/${id}`, clientData),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('clients');
        setEditingClient(null);
        resetForm();
        toast.success('Client updated successfully!');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || error.message || 'Failed to update client';
        toast.error(errorMessage);
        console.error('Update client error:', error);
      }
    }
  );

  // Delete client mutation
  const deleteClientMutation = useMutation(
    (id) => api.delete(`/clients/${id}`),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('clients');
        toast.success('Client deleted successfully!');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || error.message || 'Failed to delete client';
        toast.error(errorMessage);
        console.error('Delete client error:', error);
      }
    }
  );

  const resetForm = () => {
    setFormData({
      business_name: '',
      contact_person: '',
      phone: '',
      address: '',
      instagram: '',
      website: '',
      google_map_link: '',
      category: ''
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const payload = {
      business_name: formData.business_name,
      contact_person: formData.contact_person,
      phone: formData.phone,
      address: formData.address,
      instagram: formData.instagram,
      website: formData.website,
      google_location: formData.google_map_link || '',
      category: formData.category
    };

    if (editingClient) {
      updateClientMutation.mutate({ id: editingClient.id, clientData: payload });
    } else {
      addClientMutation.mutate(payload);
    }
  };

  const handleEdit = (client) => {
    setEditingClient(client);
    setFormData({
      business_name: client.business_name || '',
      contact_person: client.contact_person || '',
      phone: client.phone || '',
      address: client.address || '',
      instagram: client.instagram || '',
      website: client.website || '',
      google_map_link: client.google_location || '',
      category: client.category || ''
    });
    setShowAddModal(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this client?')) {
      deleteClientMutation.mutate(id);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const getCategoryColor = (category) => {
    const colors = {
      'ecommerce': 'bg-blue-100 text-blue-800',
      'retail': 'bg-green-100 text-green-800',
      'wholesale': 'bg-purple-100 text-purple-800',
      'service': 'bg-orange-100 text-orange-800',
      'manufacturing': 'bg-red-100 text-red-800'
    };
    return colors[category] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Client Management</h1>
        <button
          onClick={() => {
            setEditingClient(null);
            resetForm();
            setShowAddModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Client
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <input
              type="text"
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All Categories</option>
              <option value="ecommerce">E-commerce</option>
              <option value="retail">Retail</option>
              <option value="wholesale">Wholesale</option>
              <option value="service">Service</option>
              <option value="manufacturing">Manufacturing</option>
              <option value="other">Other</option>
            </select>
          </div>
          {selectedCategory === 'other' && (
            <div>
              <input
                type="text"
                placeholder="Type custom category..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* Clients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {clients?.map((client) => (
          <motion.div
            key={client.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-base font-semibold text-gray-900 mb-1">
                  {client.business_name}
                </h3>
                {client.category && (
                  <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full ${getCategoryColor(client.category)}`}>
                    {client.category}
                  </span>
                )}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEdit(client)}
                  className="text-indigo-600 hover:text-indigo-900 p-1"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(client.id)}
                  className="text-red-600 hover:text-red-900 p-1"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {client.contact_person && (
                <div className="flex items-center text-xs text-gray-600">
                  <User className="w-4 h-4 mr-1" />
                  <span className="truncate">{client.contact_person}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center text-xs text-gray-600">
                  <Phone className="w-4 h-4 mr-1" />
                  <span className="truncate">{client.phone}</span>
                </div>
              )}
              {client.address && (
                <div className="flex items-center text-xs text-gray-600 col-span-2">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span className="truncate">{client.address}</span>
                </div>
              )}
              {client.instagram && (
                <div className="flex items-center text-xs text-gray-600">
                  <Instagram className="w-4 h-4 mr-1" />
                  <span className="truncate">{client.instagram}</span>
                </div>
              )}
              {client.website && (
                <div className="flex items-center text-xs text-gray-600">
                  <Globe className="w-4 h-4 mr-1" />
                  <a 
                    href={client.website.startsWith('http') ? client.website : `https://${client.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 truncate"
                  >
                    {client.website}
                  </a>
                </div>
              )}
              {client.google_location && (
                <div className="flex items-center text-xs text-gray-600 col-span-2">
                  <Map className="w-4 h-4 mr-1" />
                  <a
                    href={String(client.google_location).startsWith('http') ? client.google_location : `https://www.google.com/maps/search/?api=1&query=${client.google_location}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 truncate"
                  >
                    Open in Google Maps
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-4 w-full max-w-xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">
                  {editingClient ? 'Edit Client' : 'Add New Client'}
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Business Name */}
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Name *
                    </label>
                    <input
                      type="text"
                      name="business_name"
                      value={formData.business_name}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      required
                    />
                  </div>

                  {/* Contact Person */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      name="contact_person"
                      value={formData.contact_person}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  {/* Address */}
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  {/* Instagram */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Instagram
                    </label>
                    <input
                      type="text"
                      name="instagram"
                      value={formData.instagram}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="@username"
                    />
                  </div>

                  {/* Website */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      name="website"
                      value={formData.website}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="https://example.com"
                    />
                  </div>

                  {/* Google Map Link */}
                  <div className="md:col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Google Map Link
                    </label>
                    <input
                      type="url"
                      name="google_map_link"
                      value={formData.google_map_link}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                      placeholder="https://maps.google.com/..."
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    >
                      <option value="">Select Category</option>
                      <option value="ecommerce">E-commerce</option>
                      <option value="retail">Retail</option>
                      <option value="wholesale">Wholesale</option>
                      <option value="service">Service</option>
                      <option value="manufacturing">Manufacturing</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  {formData.category === 'other' && (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Custom Category</label>
                      <input
                        type="text"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Type category"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addClientMutation.isLoading || updateClientMutation.isLoading}
                    className="px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2 text-sm"
                  >
                    {(addClientMutation.isLoading || updateClientMutation.isLoading) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {editingClient ? 'Update Client' : 'Create Client'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CRM;
