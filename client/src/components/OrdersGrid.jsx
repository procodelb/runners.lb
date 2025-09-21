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
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [editingRow, setEditingRow] = useState(null);
  const [newRows, setNewRows] = useState([]);
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(-1);

  const queryClient = useQueryClient();

  // Fetch orders with search and filters
  const { data: orders, isLoading } = useQuery(
    ['orders', searchTerm, selectedStatus, selectedBrand, selectedType, dateFrom, dateTo],
    () => api.get(`/orders?search=${encodeURIComponent(searchTerm)}&status=${selectedStatus}&brand_name=${encodeURIComponent(selectedBrand)}&type=${selectedType}` + (dateFrom ? `&date_from=${dateFrom}` : '') + (dateTo ? `&date_to=${dateTo}` : '')), 
    {
      keepPreviousData: true,
      select: (response) => response.data?.data || []
    }
  );

  // Fetch drivers for assignment
  const { data: drivers } = useQuery('drivers', () => api.get('/drivers'), {
    select: (response) => response.data?.data || []
  });

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
    ({ orderIds, driverId }) => api.patch('/orders/batch/assign', { order_ids: orderIds, driver_id: driverId }),
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

  // Client search mutation
  const clientSearchMutation = useMutation(
    (query) => api.get(`/orders/clients/search?q=${encodeURIComponent(query)}`),
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
      order_ref: '',
      brand_name: '',
      customer_name: '',
      customer_phone: '',
      location_text: '',
      google_maps_url: '',
      latitude: '',
      longitude: '',
      price_usd: '',
      price_lbp: '',
      fee_usd: '',
      fee_lbp: '',
      delivery_type: 'direct',
      delivery_mode: 'in_house',
      third_party_id: '',
      prepaid_status: 'unpaid',
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
    updateRowData(rowId, 'customer_name', value);
    
    if (value.length >= 2) {
      clientSearchMutation.mutate(value);
      setSuggestionIndex(rowId);
    } else {
      setShowClientSuggestions(false);
    }
  };

  // Select client from suggestions
  const selectClient = (rowId, client) => {
    updateRowData(rowId, 'customer_name', client.business_name);
    updateRowData(rowId, 'customer_phone', client.phone);
    updateRowData(rowId, 'location_text', client.address);
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
    const validRows = newRows.filter(row => 
      row.customer_name && (row.price_usd || row.price_lbp)
    );

    if (validRows.length === 0) {
      toast.error('Please fill in at least customer name and price for new orders');
      return;
    }

    const ordersData = validRows.map(row => ({
      customer_name: row.customer_name,
      customer_phone: row.customer_phone,
      location_text: row.location_text,
      latitude: row.latitude ? parseFloat(row.latitude) : null,
      longitude: row.longitude ? parseFloat(row.longitude) : null,
      total_usd: parseFloat(row.price_usd) || 0,
      total_lbp: parseInt(row.price_lbp) || 0,
      delivery_fee_usd: parseFloat(row.fee_usd) || 0,
      delivery_fee_lbp: parseInt(row.fee_lbp) || 0,
      delivery_mode: row.delivery_mode,
      third_party_id: row.third_party_id || null,
      prepaid_status: row.prepaid_status,
      status: 'new',
      payment_status: 'unpaid'
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
      return `https://www.google.com/maps?q=${latitude},${longitude}`;
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
      return new Intl.NumberFormat('ar-LB', {
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
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Orders Grid</h1>
        <div className="flex items-center space-x-3">
          <button
            onClick={addNewRow}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Row
          </button>
          {selectedRows.size > 0 && (
            <div className="flex items-center space-x-2">
              <select
                onChange={(e) => batchAssignDriver(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                defaultValue=""
              >
                <option value="">Assign Driver to Selected</option>
                {drivers?.map(driver => (
                  <option key={driver.id} value={driver.id}>
                    {driver.full_name}
                  </option>
                ))}
              </select>
              <button
                onClick={deselectAllRows}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div>
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
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
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Brands</option>
              {/* Add brand options here */}
            </select>
          </div>
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="ecommerce">E-commerce</option>
              <option value="instant">Instant</option>
              <option value="go_to_market">Go to Market</option>
            </select>
          </div>
          <div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">
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
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Brand
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Google Maps
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price USD
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price LBP
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fee USD
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fee LBP
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Delivery
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prepaid
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allRows.map((row) => (
                <tr key={row.id} className={`hover:bg-gray-50 ${row.isNew ? 'bg-green-50' : ''}`}>
                  <td className="px-2 py-2 whitespace-nowrap">
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
                  <td className="px-2 py-2 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="text"
                        value={row.brand_name}
                        onChange={(e) => updateRowData(row.id, 'brand_name', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Brand"
                      />
                    ) : (
                      <div className="text-sm text-gray-900">{row.brand_name}</div>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {row.isNew ? (
                      <div className="relative">
                        <input
                          type="text"
                          value={row.customer_name}
                          onChange={(e) => handleClientNameChange(row.id, e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          placeholder="Client Name"
                        />
                        {showClientSuggestions && suggestionIndex === row.id && clientSuggestions.length > 0 && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                            {clientSuggestions.map((client, index) => (
                              <div
                                key={client.id}
                                onClick={() => selectClient(row.id, client)}
                                className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                              >
                                <div className="font-medium">{client.business_name}</div>
                                <div className="text-gray-500">{client.phone}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-900">{row.customer_name}</div>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="tel"
                        value={row.customer_phone}
                        onChange={(e) => updateRowData(row.id, 'customer_phone', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Phone"
                      />
                    ) : (
                      <div className="text-sm text-gray-900">{row.customer_phone}</div>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="text"
                        value={row.location_text}
                        onChange={(e) => updateRowData(row.id, 'location_text', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Location"
                      />
                    ) : (
                      <div className="text-sm text-gray-900">
                        {row.location_text}
                        {row.latitude && row.longitude && (
                          <a
                            href={generateGoogleMapsLink(row.latitude, row.longitude)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="ml-2 text-blue-600 hover:text-blue-800"
                          >
                            <Map className="w-4 h-4 inline" />
                          </a>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="url"
                        value={row.google_maps_url}
                        onChange={(e) => handleGoogleMapsUrlChange(row.id, e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Paste Google Maps URL"
                      />
                    ) : (
                      <div className="text-sm text-gray-900">
                        {row.latitude && row.longitude ? (
                          <a
                            href={generateGoogleMapsLink(row.latitude, row.longitude)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                          >
                            <Map className="w-4 h-4" />
                            View Map
                          </a>
                        ) : (
                          <span className="text-gray-400">No coordinates</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="number"
                        step="0.01"
                        value={row.price_usd}
                        onChange={(e) => updateRowData(row.id, 'price_usd', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    ) : (
                      <div className="text-sm text-gray-900">{formatCurrency(row.total_usd, 'USD')}</div>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="number"
                        value={row.price_lbp}
                        onChange={(e) => updateRowData(row.id, 'price_lbp', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0"
                      />
                    ) : (
                      <div className="text-sm text-gray-900">{formatCurrency(row.total_lbp, 'LBP')}</div>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="number"
                        step="0.01"
                        value={row.fee_usd}
                        onChange={(e) => updateRowData(row.id, 'fee_usd', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0.00"
                      />
                    ) : (
                      <div className="text-sm text-gray-900">{formatCurrency(row.delivery_fee_usd, 'USD')}</div>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {row.isNew ? (
                      <input
                        type="number"
                        value={row.fee_lbp}
                        onChange={(e) => updateRowData(row.id, 'fee_lbp', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="0"
                      />
                    ) : (
                      <div className="text-sm text-gray-900">{formatCurrency(row.delivery_fee_lbp, 'LBP')}</div>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {row.isNew ? (
                      <select
                        value={row.delivery_mode}
                        onChange={(e) => updateRowData(row.id, 'delivery_mode', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="in_house">In House</option>
                        <option value="third_party">Third Party</option>
                      </select>
                    ) : (
                      <div className="text-sm text-gray-900">{row.delivery_mode}</div>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {row.isNew ? (
                      <select
                        value={row.prepaid_status}
                        onChange={(e) => updateRowData(row.id, 'prepaid_status', e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="unpaid">Unpaid</option>
                        <option value="paid">Paid</option>
                      </select>
                    ) : (
                      <div className="text-sm text-gray-900">{row.prepaid_status}</div>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {row.isNew ? (
                      <div className="text-sm text-green-600 font-medium">New</div>
                    ) : (
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(row.status)}`}>
                        {row.status}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 whitespace-nowrap text-sm font-medium">
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
                          onClick={() => {/* Edit functionality */}}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {/* Delete functionality */}}
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
        <div className="mt-6 flex justify-end">
          <button
            onClick={submitNewRows}
            disabled={batchCreateMutation.isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            {batchCreateMutation.isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Save className="w-5 h-5" />
            )}
            Submit {newRows.length} New Orders
          </button>
        </div>
      )}
    </div>
  );
};

export default OrdersGrid;
