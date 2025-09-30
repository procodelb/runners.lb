import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  Package, 
  Truck, 
  DollarSign,
  User,
  Phone,
  MapPin,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  Save,
  Loader2,
  Eye,
  UserCheck,
  CreditCard,
  Table,
  Download,
  Upload,
  CheckSquare,
  Square,
  Map
} from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

const OrdersGrid = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('!cancelled');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedDeliveryMode, setSelectedDeliveryMode] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [editingRow, setEditingRow] = useState(null);
  const [newRows, setNewRows] = useState([]);
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [activeSuggestionField, setActiveSuggestionField] = useState('client');

  const queryClient = useQueryClient();

  // Fetch orders with search and filters
  const { data: orders, isLoading } = useQuery(
    ['orders', searchTerm, selectedStatus, selectedBrand, selectedType, selectedDeliveryMode, dateFrom, dateTo],
    () => api.get(`/orders?search=${encodeURIComponent(searchTerm)}&status=${encodeURIComponent(selectedStatus)}` + `&brand_name=${encodeURIComponent(selectedBrand)}&type=${selectedType}` + (selectedDeliveryMode ? `&delivery_mode=${selectedDeliveryMode}` : '') + (dateFrom ? `&date_from=${dateFrom}` : '') + (dateTo ? `&date_to=${dateTo}` : '')), 
    {
      keepPreviousData: true,
      select: (response) => response.data?.data || []
    }
  );

  // Fetch drivers for assignment
  const { data: drivers } = useQuery('drivers', () => api.get('/drivers'), {
    select: (response) => response.data?.data || []
  });

  // Delete existing order
  const deleteOrderMutation = useMutation(
    (id) => api.delete(`/orders/${id}`),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('orders');
        toast.success('Order deleted successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to delete order');
      }
    }
  );

  // Update existing order (minimal editable fields)
  const updateOrderMutation = useMutation(
    ({ id, data }) => api.put(`/orders/${id}`, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('orders');
        setEditingRow(null);
        toast.success('Order updated');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update order');
      }
    }
  );

  // Batch create orders mutation
  const batchCreateMutation = useMutation(
    (ordersData) => api.post('/orders/batch', { orders: ordersData }),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('orders');
        setNewRows([]);
        toast.success(`Successfully created ${response.data.data.length} orders!`);
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || error.message || 'Failed to create orders';
        toast.error(errorMessage);
        console.error('Batch create error:', error);
      }
    }
  );

  // Batch assign driver mutation
  const batchAssignMutation = useMutation(
    ({ orderIds, driverId }) => api.patch('/orders/assign', { order_ids: orderIds, driver_id: driverId }),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('orders');
        setSelectedRows(new Set());
        toast.success(`Successfully assigned driver to ${response.data.data.length} orders!`);
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || error.message || 'Failed to assign driver';
        toast.error(errorMessage);
        console.error('Batch assign error:', error);
      }
    }
  );

  // Client search mutation (unified /clients endpoint)
  const clientSearchMutation = useMutation(
    (query) => api.get('/clients', { params: { search: query } }),
    {
      onSuccess: (response) => {
        setClientSuggestions(response.data.data || []);
        setShowClientSuggestions(true);
      },
      onError: (error) => {
        console.error('Client search error:', error);
        setClientSuggestions([]);
      }
    }
  );

  // Add new row
  const addNewRow = () => {
    const newRow = {
      id: `new-${Date.now()}`,
      client: '',
      phone: '',
      customer: '',
      address: '',
      google_maps_url: '',
      latitude: '',
      longitude: '',
      price_usd: '',
      price_lbp: '',
      delivery_fees_usd: '',
      delivery_fees_lbp: '',
      order_type: 'ecommerce',
      delivery_mode: 'direct',
      third_party_id: '',
      third_party_fee_usd: '',
      third_party_fee_lbp: '',
      driver_id: '',
      payment_status: 'unpaid',
      order_status: 'new',
      note: '',
      isNew: true
    };
    setNewRows(prev => [...prev, newRow]);
  };

  // Remove new row
  const removeNewRow = (rowId) => {
    setNewRows(prev => prev.filter(row => row.id !== rowId));
  };

  // Update row data
  const updateRowData = (rowId, field, value) => {
    if (rowId.startsWith('new-')) {
      setNewRows(prev => prev.map(row => 
        row.id === rowId ? { ...row, [field]: value } : row
      ));
    }
  };

  // Handle client name change with autocomplete
  const handleClientNameChange = (rowId, value) => {
    updateRowData(rowId, 'client', value);
    
    if (value.length >= 2) {
      clientSearchMutation.mutate(value);
      setSuggestionIndex(rowId);
      setActiveSuggestionField('client');
    } else {
      setShowClientSuggestions(false);
    }
  };

  // Handle phone change with autocomplete
  const handlePhoneChange = (rowId, value) => {
    updateRowData(rowId, 'phone', value);
    const digits = (value || '').replace(/\D+/g, '');
    if (digits.length >= 5) {
      clientSearchMutation.mutate(value);
      setSuggestionIndex(rowId);
      setActiveSuggestionField('phone');
    } else {
      setShowClientSuggestions(false);
    }
  };

  // Select client from suggestions
  const selectClient = (rowId, client) => {
    updateRowData(rowId, 'client', client.business_name || client.name || '');
    updateRowData(rowId, 'phone', client.phone || '');
    updateRowData(rowId, 'address', client.address || client.location || '');
    if (client.default_delivery_fee_usd) updateRowData(rowId, 'delivery_fees_usd', String(client.default_delivery_fee_usd));
    if (client.default_delivery_fee_lbp) updateRowData(rowId, 'delivery_fees_lbp', String(client.default_delivery_fee_lbp));
    // Autofill google map link/coordinates if available
    if (client.google_location) {
      const loc = String(client.google_location);
      if (/^https?:\/\//i.test(loc)) {
        updateRowData(rowId, 'google_maps_url', loc);
        const coords = parseGoogleMapsUrl(loc);
        if (coords) {
          updateRowData(rowId, 'latitude', coords.latitude.toString());
          updateRowData(rowId, 'longitude', coords.longitude.toString());
        }
      } else if (/^-?\d+\.\d+\s*,\s*-?\d+\.\d+$/.test(loc)) {
        const [lat, lng] = loc.split(',').map(s => s.trim());
        updateRowData(rowId, 'latitude', lat);
        updateRowData(rowId, 'longitude', lng);
      }
    }
    setShowClientSuggestions(false);
  };

  // Toggle row selection
  const toggleRowSelection = (rowId) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(rowId)) {
      newSelected.delete(rowId);
    } else {
      newSelected.add(rowId);
    }
    setSelectedRows(newSelected);
  };

  // Select all rows
  const selectAllRows = () => {
    const allRowIds = [...(orders || []).map(order => order.id), ...newRows.map(row => row.id)];
    setSelectedRows(new Set(allRowIds));
  };

  // Deselect all rows
  const deselectAllRows = () => {
    setSelectedRows(new Set());
  };

  // Submit new rows
  const submitNewRows = () => {
    const targetRows = newRows.filter(r => selectedRows.has(r.id));
    const rowsToSubmit = targetRows.length > 0 ? targetRows : newRows;
    const validRows = rowsToSubmit.filter(row => 
      row.client && row.customer && (row.price_usd || row.price_lbp)
    );

    if (validRows.length === 0) {
      toast.error('Please fill in at least customer name and price for new orders');
      return;
    }

    const toNumber = (v, int = false) => {
      const s = String(v ?? '').replace(/,/g, '').trim();
      const n = Number(s);
      if (!Number.isFinite(n)) return 0;
      return int ? Math.round(n) : Math.round(n * 100) / 100;
    };

    const ordersData = validRows.map(row => ({
      brand_name: row.client,
      customer_name: row.customer,
      customer_phone: row.phone,
      customer_address: row.address,
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      total_usd: toNumber(row.price_usd, false),
      total_lbp: toNumber(row.price_lbp, true),
      delivery_fee_usd: toNumber(row.delivery_fees_usd, false),
      delivery_fee_lbp: toNumber(row.delivery_fees_lbp, true),
      type: row.order_type,
      delivery_mode: row.delivery_mode,
      third_party_id: row.delivery_mode === 'third_party' ? (row.third_party_id || null) : null,
      third_party_fee_usd: row.delivery_mode === 'third_party' ? toNumber(row.third_party_fee_usd, false) : 0,
      third_party_fee_lbp: row.delivery_mode === 'third_party' ? toNumber(row.third_party_fee_lbp, true) : 0,
      driver_id: row.driver_id ? parseInt(row.driver_id) : null,
      payment_status: row.payment_status,
      status: row.order_status,
      notes: row.note || ''
    }));

    batchCreateMutation.mutate(ordersData);
  };

  // Batch assign driver
  const batchAssignDriver = (driverId) => {
    if (selectedRows.size === 0) {
      toast.error('Please select orders to assign driver');
      return;
    }

    const orderIds = Array.from(selectedRows).filter(id => !id.startsWith('new-'));
    if (orderIds.length === 0) {
      toast.error('Please select existing orders to assign driver');
      return;
    }

    batchAssignMutation.mutate({ orderIds, driverId });
  };

  // Parse Google Maps URL for coordinates
  const parseGoogleMapsUrl = (url) => {
    try {
      const urlObj = new URL(url);
      if (urlObj.hostname.includes('google.com') && urlObj.pathname.includes('/maps')) {
        // Try different patterns for Google Maps URLs
        const patterns = [
          /@(-?\d+\.\d+),(-?\d+\.\d+)/,  // @lat,lng
          /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,  // !3dlat!4dlng
          /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,  // ll=lat,lng
          /center=(-?\d+\.\d+)%2C(-?\d+\.\d+)/,  // center=lat%2Clng
        ];
        
        for (const pattern of patterns) {
          const match = url.match(pattern);
          if (match) {
            return {
              latitude: parseFloat(match[1]),
              longitude: parseFloat(match[2])
            };
          }
        }
      }
    } catch (error) {
      console.error('Error parsing Google Maps URL:', error);
    }
    return null;
  };

  // Handle Google Maps URL input
  const handleGoogleMapsUrlChange = (rowId, url) => {
    updateRowData(rowId, 'google_maps_url', url);
    
    if (url) {
      const coords = parseGoogleMapsUrl(url);
      if (coords) {
        updateRowData(rowId, 'latitude', coords.latitude.toString());
        updateRowData(rowId, 'longitude', coords.longitude.toString());
        toast.success('Coordinates extracted from Google Maps URL!');
      } else {
        toast.error('Could not extract coordinates from URL. Please check the format.');
      }
    } else {
      updateRowData(rowId, 'latitude', '');
      updateRowData(rowId, 'longitude', '');
    }
  };

  // Generate Google Maps link
  const generateGoogleMapsLink = (latitude, longitude) => {
    if (latitude && longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    }
    return null;
  };

  const formatCurrency = (amount, currency = 'USD') => {
    if (currency === 'USD') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount || 0);
    } else if (currency === 'LBP') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'LBP',
      }).format(amount || 0);
    }
    return amount || 0;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      new: 'bg-blue-100 text-blue-800',
      assigned: 'bg-yellow-100 text-yellow-800',
      picked_up: 'bg-purple-100 text-purple-800',
      in_transit: 'bg-indigo-100 text-indigo-800',
      delivered: 'bg-green-100 text-green-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const allRows = [...(orders || []), ...newRows];

  return (
    <div className="container mx-auto px-2 py-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Orders Grid</h1>
        <div className="flex items-center space-x-2">
          <button
            onClick={addNewRow}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-md flex items-center gap-2 transition-colors text-sm"
          >
            <Plus className="w-5 h-5" />
            Add Row
          </button>
          <div className="flex items-center space-x-2">
            <select
              onChange={(e) => e.target.value && batchAssignDriver(e.target.value)}
              className="px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              defaultValue=""
            >
              <option value="">Assign driver…</option>
              {drivers?.map(driver => (
                <option key={driver.id} value={driver.id}>
                  {driver.full_name}
                </option>
              ))}
            </select>
            <button
              onClick={() => (selectedRows.size === allRows.length ? deselectAllRows() : selectAllRows())}
              className="px-2 py-1 border border-gray-300 rounded-md text-sm"
            >
              {selectedRows.size === allRows.length ? 'Deselect All' : 'Select All'}
            </button>
            <button
              onClick={submitNewRows}
              disabled={batchCreateMutation.isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm disabled:opacity-50"
            >
              Submit Selected
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-3 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          <div>
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="!cancelled">All Except Cancelled</option>
              <option value="">All Statuses</option>
              <option value="new">New</option>
              <option value="assigned">Assigned</option>
              <option value="picked_up">Picked Up</option>
              <option value="in_transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <div>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All Brands</option>
              {/* Add brand options here */}
            </select>
          </div>
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All Types</option>
              <option value="ecommerce">E-commerce</option>
              <option value="instant">Instant</option>
              <option value="go_to_market">Go to Market</option>
            </select>
          </div>
          <div>
            <select
              value={selectedDeliveryMode}
              onChange={(e) => setSelectedDeliveryMode(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">All Delivery</option>
              <option value="direct">In House</option>
              <option value="third_party">Third Party</option>
            </select>
          </div>
          <div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
          <div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
                  <button
                    onClick={selectedRows.size === allRows.length ? deselectAllRows : selectAllRows}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {selectedRows.size === allRows.length ? (
                      <CheckSquare className="w-4 h-4" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Address</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price USD</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price LBP</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Fees USD</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Fees LBP</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order Type</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Delivery Mode</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">3rd Party</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">3rd Fee USD</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">3rd Fee LBP</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
                <th className="px-1 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allRows.map((row) => (
                <tr key={row.id} className={`hover:bg-gray-50 ${row.isNew ? 'bg-green-50' : ''}`}>
                  <td className="px-1 py-1 whitespace-nowrap">
                    <button
                      onClick={() => toggleRowSelection(row.id)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {selectedRows.has(row.id) ? (
                        <CheckSquare className="w-4 h-4" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <div className="relative">
                        <input
                          type="text"
                          value={row.client}
                          onChange={(e) => handleClientNameChange(row.id, e.target.value)}
                          className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Client"
                        />
                        {showClientSuggestions && suggestionIndex === row.id && activeSuggestionField === 'client' && clientSuggestions.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                            {clientSuggestions.map((client, index) => (
                              <div
                                key={client.id}
                                onClick={() => selectClient(row.id, client)}
                                className="px-2 py-1 hover:bg-gray-100 cursor-pointer text-xs"
                              >
                                <div className="font-medium">{client.business_name || client.name}</div>
                                <div className="text-gray-500">{client.phone}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-900">{row.brand_name}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <div className="relative">
                        <input
                          type="tel"
                          value={row.phone}
                          onChange={(e) => handlePhoneChange(row.id, e.target.value)}
                          className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Phone"
                        />
                        {showClientSuggestions && suggestionIndex === row.id && activeSuggestionField === 'phone' && clientSuggestions.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                            {clientSuggestions.map((client) => (
                              <div
                                key={client.id}
                                onClick={() => selectClient(row.id, client)}
                                className="px-2 py-1 hover:bg-gray-100 cursor-pointer text-xs"
                              >
                                <div className="font-medium">{client.phone}</div>
                                <div className="text-gray-500">{client.business_name || client.name}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-900">{row.customer_phone}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="text"
                        value={row.customer}
                        onChange={(e) => updateRowData(row.id, 'customer', e.target.value)}
                        className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Customer full name"
                      />
                    ) : (
                      <div className="text-xs text-gray-900">{row.customer_name}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="text"
                        value={row.address}
                        onChange={(e) => updateRowData(row.id, 'address', e.target.value)}
                        className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Address"
                      />
                    ) : (
                      editingRow === row.id ? (
                        <input
                          type="text"
                          defaultValue={row.customer_address}
                          onBlur={(e) => updateOrderMutation.mutate({ id: row.id, data: { customer_address: e.target.value } })}
                          className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <div className="text-xs text-gray-900">{row.customer_address}</div>
                      )
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="number"
                        step="0.01"
                        value={row.price_usd}
                        onChange={(e) => updateRowData(row.id, 'price_usd', e.target.value)}
                        className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    ) : (
                      <div className="text-xs text-gray-900">{formatCurrency((row.computed_total_usd ?? row.total_usd), 'USD')}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="number"
                        value={row.price_lbp}
                        onChange={(e) => updateRowData(row.id, 'price_lbp', e.target.value)}
                        className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0"
                      />
                    ) : (
                      <div className="text-xs text-gray-900">{formatCurrency((row.computed_total_lbp ?? row.total_lbp), 'LBP')}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="number"
                        step="0.01"
                        value={row.delivery_fees_usd}
                        onChange={(e) => updateRowData(row.id, 'delivery_fees_usd', e.target.value)}
                        className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    ) : (
                      <div className="text-xs text-gray-900">{formatCurrency(row.delivery_fee_usd, 'USD')}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="number"
                        value={row.delivery_fees_lbp}
                        onChange={(e) => updateRowData(row.id, 'delivery_fees_lbp', e.target.value)}
                        className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0"
                      />
                    ) : (
                      <div className="text-xs text-gray-900">{formatCurrency(row.delivery_fee_lbp, 'LBP')}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <select
                        value={row.order_type}
                        onChange={(e) => updateRowData(row.id, 'order_type', e.target.value)}
                        className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="ecommerce">ecommerce</option>
                        <option value="instant">instant</option>
                        <option value="go_to_market">go_to_market</option>
                      </select>
                    ) : (
                      <div className="text-xs text-gray-900">{row.type}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <select
                        value={row.delivery_mode}
                        onChange={(e) => updateRowData(row.id, 'delivery_mode', e.target.value)}
                        className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="direct">direct</option>
                        <option value="third_party">third_party</option>
                      </select>
                    ) : (
                      <div className="text-xs text-gray-900">{row.delivery_mode}</div>
                    )}
                  </td>
                  {/* Third party fields - conditionally visible */}
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      row.delivery_mode === 'third_party' ? (
                        <input
                          type="text"
                          value={row.third_party_id}
                          onChange={(e) => updateRowData(row.id, 'third_party_id', e.target.value)}
                          className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="3rd party id"
                        />
                      ) : (
                        <div className="text-gray-400 text-xs">—</div>
                      )
                    ) : (
                      row.delivery_mode === 'third_party' ? (
                        editingRow === row.id ? (
                          <input
                            type="text"
                            defaultValue={row.third_party_id || ''}
                            onBlur={(e) => updateOrderMutation.mutate({ id: row.id, data: { third_party_id: e.target.value } })}
                            className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          <div className="text-xs text-gray-900">{row.third_party_id || '—'}</div>
                        )
                      ) : (
                        <div className="text-gray-400 text-xs">—</div>
                      )
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      row.delivery_mode === 'third_party' ? (
                        <input
                          type="number"
                          step="0.01"
                          value={row.third_party_fee_usd}
                          onChange={(e) => updateRowData(row.id, 'third_party_fee_usd', e.target.value)}
                          className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      ) : (
                        <div className="text-gray-400 text-xs">—</div>
                      )
                    ) : (
                      row.delivery_mode === 'third_party' ? (
                        editingRow === row.id ? (
                          <input
                            type="number"
                            step="0.01"
                            defaultValue={row.third_party_fee_usd || 0}
                            onBlur={(e) => updateOrderMutation.mutate({ id: row.id, data: { third_party_fee_usd: parseFloat(e.target.value) || 0 } })}
                            className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          <div className="text-xs text-gray-900">{formatCurrency(row.third_party_fee_usd, 'USD')}</div>
                        )
                      ) : (
                        <div className="text-gray-400 text-xs">—</div>
                      )
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      row.delivery_mode === 'third_party' ? (
                        <input
                          type="number"
                          value={row.third_party_fee_lbp}
                          onChange={(e) => updateRowData(row.id, 'third_party_fee_lbp', e.target.value)}
                          className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="0"
                        />
                      ) : (
                        <div className="text-gray-400 text-xs">—</div>
                      )
                    ) : (
                      row.delivery_mode === 'third_party' ? (
                        editingRow === row.id ? (
                          <input
                            type="number"
                            defaultValue={row.third_party_fee_lbp || 0}
                            onBlur={(e) => updateOrderMutation.mutate({ id: row.id, data: { third_party_fee_lbp: parseInt(e.target.value) || 0 } })}
                            className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        ) : (
                          <div className="text-xs text-gray-900">{formatCurrency(row.third_party_fee_lbp, 'LBP')}</div>
                        )
                      ) : (
                        <div className="text-gray-400 text-xs">—</div>
                      )
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <select
                        value={row.driver_id}
                        onChange={(e) => updateRowData(row.id, 'driver_id', e.target.value)}
                        className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">—</option>
                        {drivers?.map(driver => (
                          <option key={driver.id} value={driver.id}>{driver.full_name}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="text-xs text-gray-900">{row.driver_name || '—'}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      row.delivery_mode === 'third_party' ? (
                        <select
                          value={row.payment_status}
                          onChange={(e) => updateRowData(row.id, 'payment_status', e.target.value)}
                          className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="prepaid">prepaid</option>
                          <option value="paid">paid</option>
                          <option value="unpaid">unpaid</option>
                        </select>
                      ) : (
                        <div className="text-gray-400 text-xs">—</div>
                      )
                    ) : (
                      row.delivery_mode === 'third_party' ? (
                        editingRow === row.id ? (
                          <select
                            defaultValue={row.payment_status}
                            onBlur={(e) => updateOrderMutation.mutate({ id: row.id, data: { payment_status: e.target.value } })}
                            className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="prepaid">prepaid</option>
                            <option value="paid">paid</option>
                            <option value="unpaid">unpaid</option>
                          </select>
                        ) : (
                          <div className="text-xs text-gray-900">{row.payment_status}</div>
                        )
                      ) : (
                        <div className="text-gray-400 text-xs">—</div>
                      )
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <select
                        value={row.order_status}
                        onChange={(e) => updateRowData(row.id, 'order_status', e.target.value)}
                        className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="onshelf">onshelf</option>
                        <option value="on_road">on_road</option>
                        <option value="delivered">delivered</option>
                        <option value="canceled">canceled</option>
                        <option value="postponed">postponed</option>
                        <option value="completed">completed</option>
                      </select>
                    ) : (
                      editingRow === row.id ? (
                        <select
                          defaultValue={row.status}
                          onBlur={(e) => updateOrderMutation.mutate({ id: row.id, data: { status: e.target.value } })}
                          className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                          <option value="new">new</option>
                          <option value="assigned">assigned</option>
                          <option value="picked_up">picked_up</option>
                          <option value="in_transit">in_transit</option>
                          <option value="delivered">delivered</option>
                          <option value="completed">completed</option>
                          <option value="cancelled">cancelled</option>
                        </select>
                      ) : (
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(row.status)}`}>
                          {row.status}
                        </span>
                      )
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="text"
                        value={row.note}
                        onChange={(e) => updateRowData(row.id, 'note', e.target.value)}
                        className="w-full px-2 py-0.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Note"
                      />
                    ) : (
                      <div className="text-xs text-gray-900">{row.notes || ''}</div>
                    )}
                  </td>
                  <td className="px-1 py-1 whitespace-nowrap text-xs font-medium">
                    {row.isNew ? (
                      <button
                        onClick={() => removeNewRow(row.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setEditingRow(editingRow === row.id ? null : row.id)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm('Delete this order?')) deleteOrderMutation.mutate(row.id);
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submit Button for New Rows */}
      {newRows.length > 0 && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={submitNewRows}
            disabled={batchCreateMutation.isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-md flex items-center gap-2 transition-colors disabled:opacity-50 text-sm"
          >
            {batchCreateMutation.isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Submit {newRows.length} New Orders
          </button>
        </div>
      )}
    </div>
  );
};

export default OrdersGrid;