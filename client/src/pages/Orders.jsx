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
  CreditCard
} from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

const Orders = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState(null);
  const [selectedDriver, setSelectedDriver] = useState('');
  const [formData, setFormData] = useState({
    order_ref: '',
    voucher_code: '',
    brand_name: '',
    customer_name: '',
    customer_phone: '',
    customer_address: '',
    driver_id: '',
    type: 'ecommerce',
    deliver_method: 'in_house',
    status: 'new',
    payment_status: 'unpaid',
    notes: '',
    total_usd: '',
    total_lbp: '',
    third_party_fee_usd: '',
    third_party_fee_lbp: '',
    driver_fee_usd: '',
    driver_fee_lbp: ''
  });

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

  // Fetch clients for auto-fill
  const { data: clients } = useQuery('clients', () => api.get('/clients'), {
    select: (response) => response.data?.data || []
  });

  // Add new order mutation
  const addOrderMutation = useMutation(
    (newOrder) => api.post('/orders', newOrder),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('orders');
        setShowAddModal(false);
        resetForm();
        toast.success('Order created successfully!');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || error.message || 'Failed to create order';
        toast.error(errorMessage);
        console.error('Add order error:', error);
      }
    }
  );

  // Update order mutation
  const updateOrderMutation = useMutation(
    ({ id, orderData }) => api.put(`/orders/${id}`, orderData),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('orders');
        setEditingOrder(null);
        resetForm();
        toast.success('Order updated successfully!');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || error.message || 'Failed to update order';
        toast.error(errorMessage);
        console.error('Update order error:', error);
      }
    }
  );

  // Delete order mutation
  const deleteOrderMutation = useMutation(
    (id) => api.delete(`/orders/${id}`),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('orders');
        toast.success('Order deleted successfully!');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || error.message || 'Failed to delete order';
        toast.error(errorMessage);
        console.error('Delete order error:', error);
      }
    }
  );

  // Update order status mutation
  const updateStatusMutation = useMutation(
    ({ id, status, payment_status }) => api.put(`/orders/${id}`, { status, payment_status }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('orders');
        toast.success('Order status updated successfully!');
      },
      onError: (error) => {
        toast.error(error.response?.data?.message || 'Failed to update order status');
      }
    }
  );

  // Assign driver mutation
  const assignDriverMutation = useMutation(
    ({ orderId, driverId }) => api.post(`/orders/${orderId}/assign-driver`, { driver_id: driverId }),
    {
      onSuccess: (response) => {
        queryClient.invalidateQueries('orders');
        setSelectedDriver('');
        toast.success('Driver assigned successfully!');
      },
      onError: (error) => {
        const errorMessage = error.response?.data?.message || error.message || 'Failed to assign driver';
        toast.error(errorMessage);
        console.error('Assign driver error:', error);
      }
    }
  );

  const resetForm = () => {
    setFormData({
      order_ref: '',
      voucher_code: '',
      brand_name: '',
      customer_name: '',
      customer_phone: '',
      customer_address: '',
      driver_id: '',
      type: 'ecommerce',
      deliver_method: 'in_house',
      status: 'new',
      payment_status: 'unpaid',
      notes: '',
      total_usd: '',
      total_lbp: '',
      third_party_fee_usd: '',
      third_party_fee_lbp: '',
      driver_fee_usd: '',
      driver_fee_lbp: ''
    });
  };

  const generateOrderRef = () => {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `ORD-${timestamp}-${random}`;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Transform form data to match API expectations
    const orderData = {
      order_ref: formData.order_ref || generateOrderRef(),
      type: formData.type || 'ecommerce',
      customer_name: formData.customer_name || '',
      customer_phone: formData.customer_phone || '',
      customer_address: formData.customer_address || '',
      brand_name: formData.brand_name || '',
      voucher_code: formData.voucher_code || '',
      deliver_method: formData.deliver_method || 'in_house',
      driver_id: formData.driver_id || null,
      notes: formData.notes || '',
      total_usd: parseFloat(formData.total_usd) || 0,
      total_lbp: parseInt(formData.total_lbp) || 0,
      third_party_fee_usd: parseFloat(formData.third_party_fee_usd) || 0,
      third_party_fee_lbp: parseInt(formData.third_party_fee_lbp) || 0,
      driver_fee_usd: parseFloat(formData.driver_fee_usd) || 0,
      driver_fee_lbp: parseInt(formData.driver_fee_lbp) || 0,
      status: formData.status || 'new',
      payment_status: formData.payment_status || 'unpaid'
    };

    if (editingOrder) {
      updateOrderMutation.mutate({ id: editingOrder.id, orderData });
    } else {
      addOrderMutation.mutate(orderData);
    }
  };

  const handleEdit = (order) => {
    setEditingOrder(order);
    setFormData({
      order_ref: order.order_ref || '',
      voucher_code: order.voucher_code || '',
      brand_name: order.brand_name || '',
      customer_name: order.customer_name || '',
      customer_phone: order.customer_phone || '',
      customer_address: order.customer_address || '',
      driver_id: order.driver_id || '',
      type: order.type || 'ecommerce',
      deliver_method: order.deliver_method || 'in_house',
      status: order.status || 'new',
      payment_status: order.payment_status || 'unpaid',
      notes: order.notes || '',
      total_usd: order.total_usd || '',
      total_lbp: order.total_lbp || '',
      third_party_fee_usd: order.third_party_fee_usd || '',
      third_party_fee_lbp: order.third_party_fee_lbp || '',
      driver_fee_usd: order.driver_fee_usd || '',
      driver_fee_lbp: order.driver_fee_lbp || ''
    });
    setShowAddModal(true);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this order?')) {
      deleteOrderMutation.mutate(id);
    }
  };

  const handleStatusUpdate = (orderId, newStatus, newPaymentStatus) => {
    updateStatusMutation.mutate({
      id: orderId,
      status: newStatus,
      payment_status: newPaymentStatus
    });
  };

  const openStatusModal = (order) => {
    setStatusUpdateData({
      id: order.id,
      status: order.status,
      payment_status: order.payment_status
    });
    setShowStatusModal(true);
  };

  const handleAssignDriver = (orderId) => {
    if (selectedDriver) {
      assignDriverMutation.mutate({ orderId, driverId: selectedDriver });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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

  const getPaymentStatusColor = (status) => {
    const colors = {
      unpaid: 'bg-red-100 text-red-800',
      partial: 'bg-yellow-100 text-yellow-800',
      paid: 'bg-green-100 text-green-800',
      refunded: 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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

  const getStatusOptions = () => [
    { value: 'new', label: 'New', color: 'bg-blue-100 text-blue-800' },
    { value: 'assigned', label: 'Assigned', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'picked_up', label: 'Picked Up', color: 'bg-purple-100 text-purple-800' },
    { value: 'in_transit', label: 'In Transit', color: 'bg-indigo-100 text-indigo-800' },
    { value: 'delivered', label: 'Delivered', color: 'bg-green-100 text-green-800' },
    { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
    { value: 'cancelled', label: 'Cancelled', color: 'bg-red-100 text-red-800' }
  ];

  const getPaymentStatusOptions = () => [
    { value: 'unpaid', label: 'Unpaid', color: 'bg-red-100 text-red-800' },
    { value: 'partial', label: 'Partial', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'paid', label: 'Paid', color: 'bg-green-100 text-green-800' },
    { value: 'refunded', label: 'Refunded', color: 'bg-gray-100 text-red-800' }
  ];

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
        <h1 className="text-3xl font-bold text-gray-900">Orders Management</h1>
        <button
          onClick={() => {
            setEditingOrder(null);
            resetForm();
            setShowAddModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Order
        </button>
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
              {clients?.map(client => (
                <option key={client.id} value={client.business_name}>
                  {client.business_name}
                </option>
              ))}
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

      {/* Orders Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order Details
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders?.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">
                        {order.order_ref}
                      </div>
                      <div className="text-sm text-gray-500">
                        {order.brand_name}
                      </div>
                      <div className="text-xs text-gray-400">
                        {formatDate(order.created_at)}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">
                        {order.customer_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {order.customer_phone}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {order.driver_name || 'Unassigned'}
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getPaymentStatusColor(order.payment_status)}`}>
                        {order.payment_status}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatCurrency(order.total_usd, 'USD')}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatCurrency(order.total_lbp, 'LBP')}
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEdit(order)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(order.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">
                  {editingOrder ? 'Edit Order' : 'Add New Order'}
                </h2>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Order Reference */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Order Reference
                    </label>
                    <input
                      type="text"
                      name="order_ref"
                      value={formData.order_ref}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Auto-generated if empty"
                    />
                  </div>

                  {/* Brand Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Brand Name
                    </label>
                    <select
                      name="brand_name"
                      value={formData.brand_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Brand</option>
                      {clients?.map(client => (
                        <option key={client.id} value={client.business_name}>
                          {client.business_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Customer Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Customer Name
                    </label>
                    <input
                      type="text"
                      name="customer_name"
                      value={formData.customer_name}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  {/* Customer Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Customer Phone
                    </label>
                    <input
                      type="tel"
                      name="customer_phone"
                      value={formData.customer_phone}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Customer Address */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Customer Address
                    </label>
                    <input
                      type="text"
                      name="customer_address"
                      value={formData.customer_address}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Order Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Order Type
                    </label>
                    <select
                      name="type"
                      value={formData.type}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ecommerce">E-commerce</option>
                      <option value="instant">Instant</option>
                      <option value="go_to_market">Go to Market</option>
                    </select>
                  </div>

                  {/* Delivery Method */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delivery Method
                    </label>
                    <select
                      name="deliver_method"
                      value={formData.deliver_method}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="in_house">In House</option>
                      <option value="third_party">Third Party</option>
                    </select>
                  </div>

                  {/* Driver */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Driver
                    </label>
                    <select
                      name="driver_id"
                      value={formData.driver_id}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select Driver</option>
                      {drivers?.map(driver => (
                        <option key={driver.id} value={driver.id}>
                          {driver.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Voucher Code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Voucher Code
                    </label>
                    <input
                      type="text"
                      name="voucher_code"
                      value={formData.voucher_code}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Total USD */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total USD
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="total_usd"
                      value={formData.total_usd}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Total LBP */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total LBP
                    </label>
                    <input
                      type="number"
                      name="total_lbp"
                      value={formData.total_lbp}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Third Party Fee USD */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Third Party Fee USD
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="third_party_fee_usd"
                      value={formData.third_party_fee_usd}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Third Party Fee LBP */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Third Party Fee LBP
                    </label>
                    <input
                      type="number"
                      name="third_party_fee_lbp"
                      value={formData.third_party_fee_lbp}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Driver Fee USD */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Driver Fee USD
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="driver_fee_usd"
                      value={formData.driver_fee_usd}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Driver Fee LBP */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Driver Fee LBP
                    </label>
                    <input
                      type="number"
                      name="driver_fee_lbp"
                      value={formData.driver_fee_lbp}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="new">New</option>
                      <option value="assigned">Assigned</option>
                      <option value="picked_up">Picked Up</option>
                      <option value="in_transit">In Transit</option>
                      <option value="delivered">Delivered</option>
                      <option value="completed">Completed</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>

                  {/* Payment Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Status
                    </label>
                    <select
                      name="payment_status"
                      value={formData.payment_status}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="unpaid">Unpaid</option>
                      <option value="partial">Partial</option>
                      <option value="paid">Paid</option>
                      <option value="refunded">Refunded</option>
                    </select>
                  </div>

                  {/* Notes */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Additional notes about the order..."
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addOrderMutation.isLoading || updateOrderMutation.isLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    {(addOrderMutation.isLoading || updateOrderMutation.isLoading) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {editingOrder ? 'Update Order' : 'Create Order'}
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

export default Orders;

