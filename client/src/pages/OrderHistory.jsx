import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { motion } from 'framer-motion';
import { Calendar, Filter, Search, FileText, Download, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import api from '../api';

const OrderHistory = () => {
  const [filters, setFilters] = useState({
    from_date: '',
    to_date: '',
    brand_name: '',
    driver_id: '',
    type: ''
  });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);

  const { data: orders, isLoading, error, refetch } = useQuery(
    ['orderHistory', filters],
    () => api.get('/orders/history', { params: filters }),
    {
      refetchOnWindowFocus: false,
      retry: 1
    }
  );

  const { data: drivers } = useQuery(
    ['drivers'],
    () => api.get('/drivers'),
    { 
      refetchOnWindowFocus: false,
      select: (response) => response.data?.data || []
    }
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      from_date: '',
      to_date: '',
      brand_name: '',
      driver_id: '',
      type: ''
    });
  };

  const exportToPDF = async (order) => {
    try {
      const response = await api.get(`/orders/${order.id}/export-pdf`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `order-${order.order_ref}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Order exported successfully!');
    } catch (error) {
      toast.error('Failed to export order');
    }
  };

  const viewOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
  };

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
        <p className="text-red-600">Error loading order history</p>
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
          <h1 className="text-3xl font-bold text-gray-900">Order History</h1>
          <p className="text-gray-600 mt-2">View all completed orders (status + payment status completed)</p>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-500">
            Total: {orders?.length || 0} orders
          </span>
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={filters.from_date}
              onChange={(e) => handleFilterChange('from_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={filters.to_date}
              onChange={(e) => handleFilterChange('to_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Brand Name
            </label>
            <input
              type="text"
              placeholder="Search brand..."
              value={filters.brand_name}
              onChange={(e) => handleFilterChange('brand_name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Driver
            </label>
            <select
              value={filters.driver_id}
              onChange={(e) => handleFilterChange('driver_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Drivers</option>
              {drivers?.map(driver => (
                <option key={driver.id} value={driver.id}>
                  {driver.full_name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Order Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">All Types</option>
              <option value="ecommerce">E-Commerce</option>
              <option value="instant">Instant</option>
              <option value="go_to_market">Go to Market</option>
            </select>
          </div>
        </div>
        
        <div className="flex items-center justify-end space-x-3 mt-4">
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Clear Filters
          </button>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Apply Filters
          </button>
        </div>
      </motion.div>

      {/* Orders Table */}
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
                  Order Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Financial
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Completed
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {orders?.map((order) => (
                <motion.tr
                  key={order.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          #{order.order_ref}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          order.type === 'ecommerce' ? 'bg-blue-100 text-blue-800' :
                          order.type === 'instant' ? 'bg-green-100 text-green-800' :
                          'bg-purple-100 text-purple-800'
                        }`}>
                          {order.type}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {order.brand_name && (
                          <span className="block">Brand: {order.brand_name}</span>
                        )}
                        {order.voucher_code && (
                          <span className="block">Voucher: {order.voucher_code}</span>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-900">
                        {order.customer_name || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {order.customer_phone || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {order.customer_address || 'N/A'}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <div className="text-sm font-medium text-gray-900">
                        {order.driver_name || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600">
                        {order.driver_phone || 'N/A'}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      {order.total_usd > 0 && (
                        <div className="text-sm font-medium text-gray-900">
                          ${order.total_usd.toFixed(2)}
                        </div>
                      )}
                      {order.total_lbp > 0 && (
                        <div className="text-sm text-gray-600">
                          {order.total_lbp.toLocaleString()} LBP
                        </div>
                      )}
                      {order.driver_fee_lbp > 0 && (
                        <div className="text-xs text-gray-500">
                          Driver Fee: {order.driver_fee_lbp.toLocaleString()} LBP
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">
                      {order.completed_at ? format(new Date(order.completed_at), 'MMM dd, yyyy') : 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {order.completed_at ? format(new Date(order.completed_at), 'HH:mm') : ''}
                    </div>
                  </td>
                  
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => viewOrderDetails(order)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View Details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => exportToPDF(order)}
                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Export PDF"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {orders?.data?.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No completed orders found</p>
            <p className="text-gray-400 text-sm">Try adjusting your filters or check back later</p>
          </div>
        )}
      </motion.div>

      {/* Order Details Modal */}
      {showOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">
                  Order Details - #{selectedOrder.order_ref}
                </h3>
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Order Information</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Order Type:</span>
                        <span className="font-medium">{selectedOrder.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Status:</span>
                        <span className="font-medium">{selectedOrder.status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Payment Status:</span>
                        <span className="font-medium">{selectedOrder.payment_status}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Delivery Method:</span>
                        <span className="font-medium">{selectedOrder.deliver_method}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Customer Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Name:</span>
                        <span className="font-medium">{selectedOrder.customer_name || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Phone:</span>
                        <span className="font-medium">{selectedOrder.customer_phone || 'N/A'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Address:</span>
                        <span className="font-medium">{selectedOrder.customer_address || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Financial Details</h4>
                    <div className="space-y-2 text-sm">
                      {selectedOrder.total_usd > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total USD:</span>
                          <span className="font-medium">${selectedOrder.total_usd.toFixed(2)}</span>
                        </div>
                      )}
                      {selectedOrder.total_lbp > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Total LBP:</span>
                          <span className="font-medium">{selectedOrder.total_lbp.toLocaleString()} LBP</span>
                        </div>
                      )}
                      {selectedOrder.driver_fee_lbp > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Driver Fee:</span>
                          <span className="font-medium">{selectedOrder.driver_fee_lbp.toLocaleString()} LBP</span>
                        </div>
                      )}
                      {selectedOrder.third_party_fee_lbp > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Third Party Fee:</span>
                          <span className="font-medium">{selectedOrder.third_party_fee_lbp.toLocaleString()} LBP</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Timeline</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Created:</span>
                        <span className="font-medium">
                          {format(new Date(selectedOrder.created_at), 'MMM dd, yyyy HH:mm')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Completed:</span>
                        <span className="font-medium">
                          {selectedOrder.completed_at ? 
                            format(new Date(selectedOrder.completed_at), 'MMM dd, yyyy HH:mm') : 
                            'Not completed'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {selectedOrder.notes && (
                <div className="mt-6">
                  <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
                  <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {selectedOrder.notes}
                  </p>
                </div>
              )}
              
              <div className="flex items-center justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={() => exportToPDF(selectedOrder)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <Download className="h-4 w-4" />
                  <span>Export PDF</span>
                </button>
                <button
                  onClick={() => setShowOrderModal(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default OrderHistory;
