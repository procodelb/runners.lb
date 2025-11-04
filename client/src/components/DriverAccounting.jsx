import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { ordersApi } from '../api/orders';
import { driversApi } from '../api/drivers';
import { toast } from 'react-hot-toast';
import { 
  DollarSign, 
  User, 
  Calendar, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Eye,
  Filter,
  Search
} from 'lucide-react';

const DriverAccounting = () => {
  const [selectedDriver, setSelectedDriver] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAdvance, setSelectedAdvance] = useState(null);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [notes, setNotes] = useState('');

  const queryClient = useQueryClient();

  // Fetch drivers
  const { data: drivers, isLoading: driversLoading, error: driversError } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => driversApi.getDrivers(),
    retry: 3,
    retryDelay: 1000
  });

  // Fetch driver advances
  const { data: advancesData, isLoading } = useQuery({
    queryKey: ['driver-advances', selectedDriver, statusFilter],
    queryFn: () => ordersApi.getDriverAdvances({
      driver_id: selectedDriver || undefined,
      status: statusFilter || undefined
    })
  });

  // Clear advance mutation
  const clearAdvanceMutation = useMutation({
    mutationFn: ({ advanceId, notes }) => ordersApi.clearDriverAdvance(advanceId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries(['driver-advances']);
      toast.success('Driver advance marked as cleared');
      setShowAdvanceModal(false);
      setNotes('');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to clear advance');
    }
  });

  // Reimburse advance mutation
  const reimburseAdvanceMutation = useMutation({
    mutationFn: ({ advanceId, notes }) => ordersApi.reimburseDriverAdvance(advanceId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries(['driver-advances']);
      toast.success('Driver advance marked as reimbursed');
      setShowAdvanceModal(false);
      setNotes('');
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || 'Failed to reimburse advance');
    }
  });

  const advances = advancesData?.data || [];

  // Filter advances by search term
  const filteredAdvances = advances.filter(advance => {
    const searchLower = searchTerm.toLowerCase();
    return (
      advance.order_ref?.toLowerCase().includes(searchLower) ||
      advance.customer_name?.toLowerCase().includes(searchLower) ||
      advance.driver_name?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'cleared':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'reimbursed':
        return <DollarSign className="w-4 h-4 text-blue-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cleared':
        return 'bg-green-100 text-green-800';
      case 'reimbursed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
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

  const handleClearAdvance = (advance) => {
    setSelectedAdvance(advance);
    setShowAdvanceModal(true);
  };

  const handleReimburseAdvance = (advance) => {
    setSelectedAdvance(advance);
    setShowAdvanceModal(true);
  };

  const confirmAction = () => {
    if (!selectedAdvance) return;

    if (selectedAdvance.status === 'pending') {
      clearAdvanceMutation.mutate({ 
        advanceId: selectedAdvance.id, 
        notes: notes 
      });
    } else if (selectedAdvance.status === 'cleared') {
      reimburseAdvanceMutation.mutate({ 
        advanceId: selectedAdvance.id, 
        notes: notes 
      });
    }
  };

  const totalPending = advances.filter(a => a.status === 'pending').length;
  const totalCleared = advances.filter(a => a.status === 'cleared').length;
  const totalReimbursed = advances.filter(a => a.status === 'reimbursed').length;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Driver Accounting</h1>
        <p className="text-gray-600">Manage driver advances and reimbursements</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Advances</p>
              <p className="text-2xl font-bold text-gray-900">{totalPending}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Cleared Advances</p>
              <p className="text-2xl font-bold text-gray-900">{totalCleared}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Reimbursed</p>
              <p className="text-2xl font-bold text-gray-900">{totalReimbursed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Driver</label>
            <select
              value={selectedDriver}
              onChange={(e) => setSelectedDriver(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={driversLoading}
            >
              <option value="">All Drivers</option>
              {driversLoading ? (
                <option value="" disabled>Loading drivers...</option>
              ) : driversError ? (
                <option value="" disabled>Error loading drivers</option>
              ) : Array.isArray(drivers) && drivers.length > 0 ? (
                drivers.map(driver => (
                  <option key={driver.id} value={driver.id}>{driver.full_name || driver.name || `Driver ${driver.id}`}</option>
                ))
              ) : (
                <option value="" disabled>No drivers available</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="cleared">Cleared</option>
              <option value="reimbursed">Reimbursed</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search orders..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSelectedDriver('');
                setStatusFilter('');
                setSearchTerm('');
              }}
              className="w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Advances Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order Ref
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Driver
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount USD
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount LBP
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              ) : filteredAdvances.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-4 text-center text-gray-500">
                    No advances found
                  </td>
                </tr>
              ) : (
                filteredAdvances.map((advance) => (
                  <tr key={advance.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {advance.order_ref}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{advance.driver_name}</div>
                        <div className="text-gray-500">{advance.driver_phone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        <div className="font-medium">{advance.customer_name}</div>
                        <div className="text-gray-500">{advance.customer_phone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(advance.amount_usd, 'USD')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(advance.amount_lbp, 'LBP')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(advance.status)}`}>
                        {getStatusIcon(advance.status)}
                        <span className="ml-1 capitalize">{advance.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(advance.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        {advance.status === 'pending' && (
                          <button
                            onClick={() => handleClearAdvance(advance)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Mark Cleared
                          </button>
                        )}
                        {advance.status === 'cleared' && (
                          <button
                            onClick={() => handleReimburseAdvance(advance)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Reimburse
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Modal */}
      {showAdvanceModal && selectedAdvance && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {selectedAdvance.status === 'pending' ? 'Mark Advance as Cleared' : 'Reimburse Advance'}
              </h3>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Order:</strong> {selectedAdvance.order_ref}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Driver:</strong> {selectedAdvance.driver_name}
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Amount USD:</strong> {formatCurrency(selectedAdvance.amount_usd, 'USD')}
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  <strong>Amount LBP:</strong> {formatCurrency(selectedAdvance.amount_lbp, 'LBP')}
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Add notes..."
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowAdvanceModal(false);
                    setNotes('');
                    setSelectedAdvance(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAction}
                  disabled={clearAdvanceMutation.isPending || reimburseAdvanceMutation.isPending}
                  className={`px-4 py-2 text-sm font-medium text-white rounded-md ${
                    selectedAdvance.status === 'pending'
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  } disabled:opacity-50`}
                >
                  {clearAdvanceMutation.isPending || reimburseAdvanceMutation.isPending
                    ? 'Processing...'
                    : selectedAdvance.status === 'pending'
                    ? 'Mark Cleared'
                    : 'Reimburse'
                  }
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DriverAccounting;
